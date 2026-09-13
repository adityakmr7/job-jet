import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

/** Extracts plain text from an uploaded resume file (PDF or DOCX). */
export async function extractResumeText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  if (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.toLowerCase().endsWith(".docx")
  ) {
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }

  throw new Error(`Unsupported resume file type: ${file.type || file.name}`);
}
