import { google } from "googleapis";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { createCanvas } from "canvas";
import { Buffer } from "buffer";

const require = createRequire(import.meta.url);
// FIX 2: pdf-parse default export is the function itself, not { PDFParse }
const pdf = require("pdf-parse");
const mammoth = require("mammoth");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class GmailService {
  constructor(auth) {
    this.gmail = google.gmail({ version: "v1", auth });
    this.credentialsPath = path.join(__dirname, "..", "credentials.json");
    this.tokenPath = path.join(__dirname, "..", "token.json");
  }

  async initialize() {
    try {
      const credentials = await this.loadCredentials();

      this.auth = new google.auth.OAuth2(
        credentials.client_id,
        credentials.client_secret,
        "urn:ietf:wg:oauth:2.0:oob",
      );

      await this.loadOrGetToken();

      this.gmail = google.gmail({ version: "v1", auth: this.auth });
      console.error("✅ Gmail service initialized successfully");
    } catch (error) {
      throw new Error(`Failed to initialize Gmail service: ${error.message}`);
    }
  }

  async loadCredentials() {
    const content = await fs.readFile(this.credentialsPath, "utf8");
    const credentials = JSON.parse(content);
    return (
      credentials.installed ||
      credentials.web ||
      (() => {
        throw new Error("Invalid credentials.json");
      })()
    );
  }

  async loadOrGetToken() {
    try {
      const token = JSON.parse(await fs.readFile(this.tokenPath, "utf8"));
      this.auth.setCredentials(token);
      if (token.expiry_date && token.expiry_date <= Date.now()) {
        await this.refreshToken();
      }
    } catch {
      await this.getNewToken();
    }
  }

  async getNewToken() {
    const authCode = process.env.AUTH_CODE;
    if (authCode) {
      const { tokens } = await this.auth.getToken(authCode);
      this.auth.setCredentials(tokens);
      await fs.writeFile(this.tokenPath, JSON.stringify(tokens, null, 2));
      console.error("✅ Token saved successfully");
      return;
    }

    const authUrl = this.auth.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.modify",
      ],
    });

    throw new Error(
      `Authentication required. Visit:\n${authUrl}\nThen set AUTH_CODE=... and restart`,
    );
  }

  async refreshToken() {
    const { credentials } = await this.auth.refreshAccessToken();
    this.auth.setCredentials(credentials);
    await fs.writeFile(this.tokenPath, JSON.stringify(credentials, null, 2));
  }

  async sendEmail(emailData) {
    if (!this.gmail) throw new Error("Gmail service not initialized");

    try {
      const message = await this.createMessage(emailData);
      const response = await this.gmail.users.messages.send({
        userId: "me",
        requestBody: { raw: message },
      });
      return { messageId: response.data.id, threadId: response.data.threadId };
    } catch (error) {
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  async createMessage(emailData) {
    const { to, subject, body, cc, bcc, html, attachments } = emailData;

    const toArray = Array.isArray(to) ? to : [to];
    const ccArray = cc ? (Array.isArray(cc) ? cc : [cc]) : [];
    const bccArray = bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : [];

    let headers = [`To: ${toArray.join(", ")}`, `Subject: ${subject}`];
    if (ccArray.length > 0) headers.push(`Cc: ${ccArray.join(", ")}`);
    if (bccArray.length > 0) headers.push(`Bcc: ${bccArray.join(", ")}`);

    let emailContent;

    if (attachments && attachments.length > 0) {
      const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      headers.push(`MIME-Version: 1.0`);
      headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

      let parts = [];
      parts.push(`--${boundary}`);
      parts.push(
        `Content-Type: ${html ? "text/html" : "text/plain"}; charset=utf-8`,
      );
      parts.push(`Content-Transfer-Encoding: base64`);
      parts.push("");
      parts.push(Buffer.from(body, "utf-8").toString("base64"));

      for (const attachmentPath of attachments) {
        try {
          const fileName = path.basename(attachmentPath);
          const fileContent = await fs.readFile(attachmentPath);
          parts.push(`--${boundary}`);
          parts.push(`Content-Type: application/octet-stream`);
          parts.push(`Content-Disposition: attachment; filename="${fileName}"`);
          parts.push(`Content-Transfer-Encoding: base64`);
          parts.push("");
          parts.push(fileContent.toString("base64"));
        } catch (error) {
          console.error(
            `Failed to attach file ${attachmentPath}:`,
            error.message,
          );
        }
      }

      parts.push(`--${boundary}--`);
      emailContent = headers.join("\r\n") + "\r\n\r\n" + parts.join("\r\n");
    } else {
      headers.push(`MIME-Version: 1.0`);
      headers.push(
        `Content-Type: ${html ? "text/html" : "text/plain"}; charset=utf-8`,
      );
      headers.push(`Content-Transfer-Encoding: base64`);
      const bodyBase64 = Buffer.from(body, "utf-8").toString("base64");
      emailContent = headers.join("\r\n") + "\r\n\r\n" + bodyBase64;
    }

    return Buffer.from(emailContent)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  async getInboxEmails(options = {}) {
    if (!this.gmail) throw new Error("Gmail service not initialized");

    try {
      const {
        maxResults = 10,
        query = "in:inbox",
        includeSpamTrash = false,
        format = "metadata",
      } = options;

      const listResponse = await this.gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults,
        includeSpamTrash,
      });

      if (!listResponse.data.messages) return [];

      const emails = await Promise.all(
        listResponse.data.messages.map(async (message) => {
          const messageResponse = await this.gmail.users.messages.get({
            userId: "me",
            id: message.id,
            format,
          });
          return await this.formatEmailData(messageResponse.data);
        }),
      );

      return emails;
    } catch (error) {
      throw new Error(`Failed to get inbox emails: ${error.message}`);
    }
  }

  async getEmailById(emailId, format = "full") {
    if (!this.gmail) throw new Error("Gmail service not initialized");
    try {
      const response = await this.gmail.users.messages.get({
        userId: "me",
        id: emailId,
        format,
      });
      return this.formatEmailData(response.data, true);
    } catch (error) {
      throw new Error(`Failed to get email: ${error.message}`);
    }
  }

  async searchEmails(query, maxResults = 10) {
    if (!this.gmail) throw new Error("Gmail service not initialized");
    try {
      const listResponse = await this.gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults,
      });

      if (!listResponse.data.messages) return [];

      return await Promise.all(
        listResponse.data.messages.map(async (message) => {
          const messageResponse = await this.gmail.users.messages.get({
            userId: "me",
            id: message.id,
            format: "metadata",
          });
          return this.formatEmailData(messageResponse.data);
        }),
      );
    } catch (error) {
      throw new Error(`Failed to search emails: ${error.message}`);
    }
  }

  async getSentEmails(maxResults = 10) {
    return this.searchEmails("in:sent", maxResults);
  }

  async getDraftEmails(maxResults = 10) {
    if (!this.gmail) throw new Error("Gmail service not initialized");
    try {
      const listResponse = await this.gmail.users.drafts.list({
        userId: "me",
        maxResults,
      });

      if (!listResponse.data.drafts) return [];

      return await Promise.all(
        listResponse.data.drafts.map(async (draft) => {
          const draftResponse = await this.gmail.users.drafts.get({
            userId: "me",
            id: draft.id,
          });
          return {
            id: draft.id,
            message: await this.formatEmailData(draftResponse.data.message),
          };
        }),
      );
    } catch (error) {
      throw new Error(`Failed to get draft emails: ${error.message}`);
    }
  }

  async extractPdfAttachments(messageId, attachmentId = null) {
    if (!this.gmail) throw new Error("Gmail service not initialized");

    const messageResponse = await this.gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });
    const message = messageResponse.data;

    const attachmentParts = this._getAttachmentParts(
      message.payload,
      attachmentId,
    );

    if (attachmentParts.length === 0) {
      console.warn(`No attachments found in message ${messageId}`);
      return [];
    }

    const results = [];

    for (const part of attachmentParts) {
      const filename = part.filename || "untitled-attachment";
      const mimeType = part.mimeType || "application/octet-stream";
      const partAttachmentId = part.body?.attachmentId;

      let base64Data;

      if (partAttachmentId) {
        const attachResponse = await this.gmail.users.messages.attachments.get({
          userId: "me",
          messageId,
          id: partAttachmentId,
        });
        base64Data = attachResponse.data.data;
      } else if (part.body?.data) {
        base64Data = part.body.data;
      } else {
        console.warn(`Skipping ${filename} — no data source found`);
        continue;
      }

      // FIX: Use base64url decoding (Gmail uses URL-safe base64)
      const buffer = Buffer.from(base64Data, "base64url");

      let content = "[Binary File — Could not extract text]";

      try {
        if (mimeType === "application/pdf") {
          try {
            // Try native extraction first
            const pdfData = await pdf(buffer);
            content = pdfData.text?.trim() || "";

            // FIX 3: If native extraction yields little/no text, auto-escalate to OCR
            if (content.length < 50) {
              console.info(
                `Native PDF extraction insufficient for ${filename}, escalating to OCR...`,
              );
              const ocrResult = await this.extractTextFromPdfOCR(base64Data, {
                forceOcr: true,
                language: "heb+eng",
              });
              content = ocrResult.text;
            }
          } catch (pdfErr) {
            console.warn(
              `Native PDF parse failed for ${filename}: ${pdfErr.message}, trying OCR...`,
            );
            const ocrResult = await this.extractTextFromPdfOCR(base64Data, {
              forceOcr: true,
              language: "heb+eng",
            });
            content = ocrResult.text;
          }
        } else if (
          mimeType ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ) {
          const result = await mammoth.extractRawText({ buffer });
          content = result.value || "";
        } else if (mimeType.startsWith("text/")) {
          content = buffer.toString("utf-8");
        }
      } catch (extractError) {
        console.error(
          `Failed to extract text from ${filename}:`,
          extractError.message,
        );
        content = `[Text extraction failed: ${extractError.message}]`;
      }

      results.push({
        filename,
        mimeType,
        content,
        size: buffer.length,
        base64Data,
      });
    }

    if (attachmentId && results.length === 1) return results[0];
    return results;
  }

  _getAttachmentParts(payload, specificAttachmentId = null) {
    let parts = [];
    if (!payload) return parts;

    if (
      payload.filename &&
      payload.body &&
      (payload.body.attachmentId || payload.body.data)
    ) {
      if (
        !specificAttachmentId ||
        payload.body.attachmentId === specificAttachmentId
      ) {
        parts.push(payload);
      }
    }

    if (payload.parts && Array.isArray(payload.parts)) {
      for (const child of payload.parts) {
        parts = parts.concat(
          this._getAttachmentParts(child, specificAttachmentId),
        );
      }
    }

    return parts;
  }

  // FIX 4: NodeCanvasFactory extracted as a reusable helper method
  _createNodeCanvasFactory() {
    return {
      create(width, height) {
        const canvas = createCanvas(width, height);
        return { canvas, context: canvas.getContext("2d") };
      },
      reset(canvasAndContext, width, height) {
        canvasAndContext.canvas.width = width;
        canvasAndContext.canvas.height = height;
      },
      destroy(canvasAndContext) {
        canvasAndContext.canvas.width = 0;
        canvasAndContext.canvas.height = 0;
      },
    };
  }

  async extractTextFromPdfOCR(pdfContent, options = {}) {
    const { forceOcr = false, language = "heb+eng", maxPages = 9999 } = options;

    // Normalise input to Buffer
    let buffer;
    if (typeof pdfContent === "string") {
      const base64Data = pdfContent.includes("base64,")
        ? pdfContent.split("base64,")[1]
        : pdfContent;
      // FIX 5: Use base64url to match Gmail's encoding
      buffer = Buffer.from(base64Data, "base64url");
    } else if (Buffer.isBuffer(pdfContent)) {
      buffer = pdfContent;
    } else {
      buffer = Buffer.from(pdfContent);
    }

    const pdfData = new Uint8Array(buffer);
    let tesseractWorker = null;
    const NodeCanvasFactory = this._createNodeCanvasFactory();

    try {
      const loadingTask = pdfjsLib.getDocument({
        data: pdfData,
        canvasFactory: NodeCanvasFactory, // Required for Node.js
      });

      const pdfDoc = await loadingTask.promise;
      const numPages = Math.min(pdfDoc.numPages, maxPages);

      // Try native text first (fast, no OCR needed)
      if (!forceOcr) {
        let nativeText = "";
        for (let i = 1; i <= numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const content = await page.getTextContent();
          nativeText +=
            content.items.map((item) => item.str).join(" ") + "\n\n";
        }
        if (nativeText.trim().length > 150) {
          return {
            text: nativeText.trim(),
            numPages,
            language,
            usedOcr: false,
          };
        }
        console.info("Native extraction insufficient, falling back to OCR...");
      }

      // FIX 6: Tesseract.createWorker API changed in v4 — language is first arg
      console.info(`🚀 OCR | Language: ${language} | Pages: ${numPages}`);
      tesseractWorker = await Tesseract.createWorker(language, 1, {
        logger: (m) => {
          if (m.status === "recognizing text") {
            console.debug(`OCR progress: ${Math.round(m.progress * 100)}%`);
          }
        },
      });

      const textParts = [];
      for (let i = 1; i <= numPages; i++) {
        console.info(`OCR page ${i}/${numPages}`);
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });

        const canvasAndContext = NodeCanvasFactory.create(
          viewport.width,
          viewport.height,
        );

        await page.render({
          canvasContext: canvasAndContext.context,
          viewport,
          canvasFactory: NodeCanvasFactory,
        }).promise;

        const imageBuffer = canvasAndContext.canvas.toBuffer("image/png");
        const {
          data: { text: pageText },
        } = await tesseractWorker.recognize(imageBuffer);

        textParts.push(`═══════════ PAGE ${i} ═══════════\n${pageText.trim()}`);

        NodeCanvasFactory.destroy(canvasAndContext);
      }

      const text = textParts.join("\n\n");
      return { text: text.trim(), numPages, language, usedOcr: true };
    } catch (error) {
      console.error("OCR internal error:", error);
      throw error;
    } finally {
      if (tesseractWorker) await tesseractWorker.terminate().catch(() => {});
    }
  }

  formatEmailData(messageData, includeBody = false) {
    const headers = messageData.payload?.headers || [];
    const getHeader = (name) =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ||
      "";

    let body = "";
    let attachments = [];

    if (includeBody && messageData.payload) {
      const extractBody = (payload) => {
        if (payload.body?.data) {
          return Buffer.from(payload.body.data, "base64").toString("utf-8");
        }
        if (payload.parts) {
          for (const part of payload.parts) {
            if (
              part.mimeType === "text/plain" ||
              part.mimeType === "text/html"
            ) {
              if (part.body?.data) {
                return Buffer.from(part.body.data, "base64").toString("utf-8");
              }
            }
          }
        }
        return "";
      };

      body = extractBody(messageData.payload);

      const extractAttachments = (payload) => {
        if (payload.parts) {
          payload.parts.forEach((part) => {
            if (part.filename && part.filename.length > 0) {
              attachments.push({
                filename: part.filename,
                mimeType: part.mimeType,
                size: part.body?.size || 0,
                attachmentId: part.body?.attachmentId,
              });
            }
            if (part.parts) extractAttachments(part);
          });
        }
      };

      extractAttachments(messageData.payload);
    }

    return {
      id: messageData.id,
      threadId: messageData.threadId,
      labelIds: messageData.labelIds || [],
      snippet: messageData.snippet || "",
      from: getHeader("from"),
      to: getHeader("to"),
      cc: getHeader("cc"),
      bcc: getHeader("bcc"),
      subject: getHeader("subject"),
      date: getHeader("date"),
      body,
      attachments,
      sizeEstimate: messageData.sizeEstimate,
      internalDate: messageData.internalDate,
    };
  }
}
