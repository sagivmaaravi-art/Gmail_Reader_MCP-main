#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";
import { GmailService } from "./gmail-service.js";
import { EmailValidationSchema, sanitizeEmailContent } from "./validation.js";

dotenv.config();

class GmailMCPServer {
  constructor() {
    this.server = new Server(
      { name: "gmail-mcp-server", version: "1.0.0" },
      { capabilities: { tools: {} } },
    );
    this.gmailService = new GmailService();
    this.setupToolHandlers();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "send_email",
          description: "Send an email through Gmail API. Supports HTML content, attachments, CC/BCC recipients.",
          inputSchema: {
            type: "object",
            properties: {
              to: { type: ["string", "array"], items: { type: "string" }, description: "Recipient email address(es)" },
              subject: { type: "string", description: "Email subject line" },
              body: { type: "string", description: "Email body content" },
              cc: { type: ["string", "array"], items: { type: "string" }, description: "CC recipient email address(es)" },
              bcc: { type: ["string", "array"], items: { type: "string" }, description: "BCC recipient email address(es)" },
              html: { type: "boolean", description: "Whether the body contains HTML content", default: false },
              attachments: { type: "array", items: { type: "string" }, description: "Array of file paths to attach" },
            },
            required: ["to", "subject", "body"],
          },
        },
        {
          name: "get_inbox_emails",
          description: "Get emails from the inbox.",
          inputSchema: {
            type: "object",
            properties: {
              maxResults: { type: "number", description: "Maximum number of emails to retrieve (default: 10)", default: 10 },
              query: { type: "string", description: "Gmail search query (default: \"in:inbox\")", default: "in:inbox" },
              includeSpamTrash: { type: "boolean", description: "Include spam and trash emails", default: false },
            },
            required: [],
          },
        },
        {
          name: "get_email_by_id",
          description: "Get a specific email by its ID with full content including body and attachments.",
          inputSchema: {
            type: "object",
            properties: {
              emailId: { type: "string", description: "The ID of the email to retrieve" },
              format: { type: "string", description: "Format of the email data (full, metadata, minimal)", default: "full" },
            },
            required: ["emailId"],
          },
        },
        {
          name: "get_sent_emails",
          description: "Get emails from the sent folder.",
          inputSchema: {
            type: "object",
            properties: {
              maxResults: { type: "number", description: "Maximum number of emails to retrieve (default: 10)", default: 10 },
            },
            required: [],
          },
        },
        {
          name: "get_draft_emails",
          description: "Get draft emails.",
          inputSchema: {
            type: "object",
            properties: {
              maxResults: { type: "number", description: "Maximum number of draft emails to retrieve (default: 10)", default: 10 },
            },
            required: [],
          },
        },
        {
          name: "read_pdf_attachment",
          description: "Read and extract text from a PDF attachment in an email. Automatically uses OCR for scanned PDFs.",
          inputSchema: {
            type: "object",
            properties: {
              messageId: { type: "string", description: "The ID of the email" },
              attachmentId: { type: "string", description: "Optional: specific attachment ID. If omitted, all PDFs in the email are extracted." },
            },
            required: ["messageId"],
          },
        },
        {
          name: "extract_text_from_pdf_ocr",
          description: "Extracts text from ANY PDF using advanced OCR. First tries fast native text extraction, then falls back to high-accuracy OCR. Use this when read_pdf_attachment fails.",
          inputSchema: {
            type: "object",
            properties: {
              messageId: { type: "string", description: "The ID of the email containing the PDF" },
              attachmentId: { type: "string", description: "The ID of the PDF attachment to extract text from" },
              pdfContent: { type: "string", description: "Base64-encoded content of the PDF file (if not using messageId/attachmentId)" },
              forceOcr: { type: "boolean", description: "Force OCR even if native text extraction succeeds", default: false },
            },
            // FIX 7: pdfContent is NOT always required — messageId/attachmentId is a valid alternative
            required: [],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const respond = (text) => ({ content: [{ type: "text", text }] });

      try {
        switch (name) {
          case "send_email": {
            const validatedArgs = EmailValidationSchema.parse(args);
            validatedArgs.body = sanitizeEmailContent(validatedArgs.body, validatedArgs.html);
            const result = await this.gmailService.sendEmail(validatedArgs);
            return respond(`Email sent successfully! Message ID: ${result.messageId}`);
          }

          case "get_inbox_emails": {
            const emails = await this.gmailService.getInboxEmails(args);
            return respond(
              `Found ${emails.length} emails in inbox:\n\n` +
              emails.map((e) =>
                `📧 ${e.subject || "(No Subject)"}\nFrom: ${e.from}\nDate: ${e.date}\nID: ${e.id}\nSnippet: ${e.snippet}\n`
              ).join("\n---\n")
            );
          }

          case "get_email_by_id": {
            const email = await this.gmailService.getEmailById(args.emailId, args.format);
            return respond(
              `📧 Email Details:\n\n` +
              `Subject: ${email.subject || "(No Subject)"}\n` +
              `From: ${email.from}\nTo: ${email.to}\n` +
              (email.cc ? `CC: ${email.cc}\n` : "") +
              `Date: ${email.date}\nID: ${email.id}\nThread ID: ${email.threadId}\n` +
              (email.attachments.length > 0 ? `Attachments: ${email.attachments.map((a) => a.filename).join(", ")}\n` : "") +
              `\nBody:\n${email.body || email.snippet}`
            );
          }

          case "get_sent_emails": {
            const emails = await this.gmailService.getSentEmails(args.maxResults);
            return respond(
              `📤 Sent Emails:\n\nFound ${emails.length} sent emails:\n\n` +
              emails.map((e) =>
                `📧 ${e.subject || "(No Subject)"}\nTo: ${e.to}\nDate: ${e.date}\nID: ${e.id}\nSnippet: ${e.snippet}\n`
              ).join("\n---\n")
            );
          }

          case "get_draft_emails": {
            const drafts = await this.gmailService.getDraftEmails(args.maxResults);
            return respond(
              `📝 Draft Emails:\n\nFound ${drafts.length} draft emails:\n\n` +
              drafts.map((d) =>
                `📧 ${d.message.subject || "(No Subject)"}\nTo: ${d.message.to}\nDate: ${d.message.date}\nDraft ID: ${d.id}\nSnippet: ${d.message.snippet}\n`
              ).join("\n---\n")
            );
          }

          case "read_pdf_attachment": {
            const { messageId, attachmentId = null } = args;
            if (!messageId) return respond("❌ ERROR: 'messageId' is required.");

            try {
              const result = await this.gmailService.extractPdfAttachments(messageId, attachmentId);

              if (!result || (Array.isArray(result) && result.length === 0)) {
                return respond(`❌ No attachments found in message ${messageId}.`);
              }

              const attachments = Array.isArray(result) ? result : [result];
              let output = `✅ Found **${attachments.length} attachment(s)** in message ${messageId}\n\n`;

              for (const [index, att] of attachments.entries()) {
                output += `### Attachment #${index + 1}: ${att.filename}\n`;
                output += `**MIME Type:** ${att.mimeType}\n`;
                output += `**Size:** ${((att.size ?? 0) / 1024).toFixed(1)} KB\n`;
                output += `**Content:**\n\`\`\`\n${att.content}\n\`\`\`\n\n`;
                output += "─".repeat(80) + "\n\n";
              }

              return respond(output);
            } catch (error) {
              console.error("❌ read_pdf_attachment failed:", error);
              return respond(`❌ Failed to read PDF attachment\n\nMessage ID: ${messageId}\nError: ${error.message}`);
            }
          }

          case "extract_text_from_pdf_ocr": {
            const { pdfContent, messageId, attachmentId, forceOcr = false, language = "heb+eng", maxPages = 9999 } = args;

            // FIX 8: Support messageId+attachmentId as an alternative to pdfContent
            let base64Content = pdfContent;
            if (!base64Content && messageId) {
              const result = await this.gmailService.extractPdfAttachments(messageId, attachmentId || null);
              const att = Array.isArray(result) ? result[0] : result;
              if (!att) return respond("❌ No PDF attachment found in message.");
              base64Content = att.base64Data;
            }

            if (!base64Content) {
              return respond("❌ ERROR: Provide either 'pdfContent' (base64) or 'messageId'.");
            }

            try {
              // FIX 9: Call on this.gmailService, not this (was: this.extractTextFromPdfOCR)
              const result = await this.gmailService.extractTextFromPdfOCR(base64Content, {
                forceOcr,
                language,
                maxPages,
              });

              let output = `✅ **OCR PDF Extraction Complete**\n\n`;
              output += `**Language:** ${result.language}\n`;
              output += `**Pages Processed:** ${result.numPages}\n`;
              output += `**Used OCR:** ${result.usedOcr ? "Yes (scanned PDF)" : "No (native text)"}\n`;
              output += `**Total Characters:** ${result.text.length.toLocaleString()}\n\n`;
              output += `### Full Extracted Text\n\`\`\`\n${result.text}\n\`\`\`\n\n`;

              return respond(output);
            } catch (error) {
              console.error("❌ extract_text_from_pdf_ocr failed:", error);
              return respond(`❌ Failed to extract text via OCR\n\nError: ${error.message}\n\nTry forceOcr: true for scanned PDFs.`);
            }
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
      }
    });
  }

  async run() {
    try {
      await this.gmailService.initialize();
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error("Gmail MCP Server running on stdio");
    } catch (error) {
      console.error("Failed to start server:", error);
      process.exit(1);
    }
  }
}

const server = new GmailMCPServer();
server.run().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
