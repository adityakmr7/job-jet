import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import type { ResumeContent } from "@job-jet/shared";

/**
 * Deliberately plain, single-column layout — no tables, columns, or text
 * boxes. Multi-column/graphical resumes are a known way to break ATS text
 * extraction; this uses only built-in PDF fonts (Helvetica) so nothing
 * needs embedding either.
 */
const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10.5, fontFamily: "Helvetica", color: "#1a1a1a" },
  name: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  contactLine: { fontSize: 9.5, color: "#444444", marginBottom: 10 },
  section: { marginTop: 14 },
  sectionTitle: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    borderBottom: "1 solid #cccccc",
    paddingBottom: 3,
    marginBottom: 6,
  },
  summary: { lineHeight: 1.4 },
  entry: { marginBottom: 8 },
  entryHeaderRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 1 },
  entryTitle: { fontFamily: "Helvetica-Bold" },
  entryDates: { color: "#555555", fontSize: 9.5 },
  bullet: { flexDirection: "row", marginTop: 2 },
  bulletDot: { width: 10 },
  bulletText: { flex: 1, lineHeight: 1.35 },
  skillsLine: { lineHeight: 1.5 },
});

function formatDateRange(start?: string, end?: string, current?: boolean): string {
  const from = start ?? "";
  const to = current ? "Present" : (end ?? "");
  if (!from && !to) return "";
  return [from, to].filter(Boolean).join(" – ");
}

function ResumeDocument({ content }: { content: ResumeContent }) {
  return (
    <Document title={`${content.fullName} — Resume`}>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.name}>{content.fullName}</Text>
        <Text style={styles.contactLine}>
          {[content.email, content.phone, content.location].filter(Boolean).join("  •  ")}
        </Text>
        {content.links.length > 0 && (
          <Text style={styles.contactLine}>
            {content.links.map((l) => `${l.label}: ${l.url}`).join("  •  ")}
          </Text>
        )}

        {content.summary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text style={styles.summary}>{content.summary}</Text>
          </View>
        )}

        {content.experience.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Experience</Text>
            {content.experience.map((exp) => (
              <View key={exp.id} style={styles.entry} wrap={false}>
                <View style={styles.entryHeaderRow}>
                  <Text style={styles.entryTitle}>
                    {exp.title} — {exp.company}
                  </Text>
                  <Text style={styles.entryDates}>{formatDateRange(exp.startDate, exp.endDate, exp.current)}</Text>
                </View>
                {exp.bullets.map((b, i) => (
                  <View key={i} style={styles.bullet}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>{b}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {content.education.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Education</Text>
            {content.education.map((edu) => (
              <View key={edu.id} style={styles.entry} wrap={false}>
                <View style={styles.entryHeaderRow}>
                  <Text style={styles.entryTitle}>
                    {edu.school}
                    {edu.degree ? ` — ${edu.degree}` : ""}
                    {edu.fieldOfStudy ? `, ${edu.fieldOfStudy}` : ""}
                  </Text>
                  <Text style={styles.entryDates}>{formatDateRange(edu.startDate, edu.endDate)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {content.skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skills</Text>
            <Text style={styles.skillsLine}>{content.skills.map((s) => s.name).join("  •  ")}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}

/** Renders a ResumeContent into a PDF, fully buffered. `pdf().toBuffer()`
 *  actually returns a Node Readable at runtime despite being typed as the
 *  looser NodeJS.ReadableStream — collecting it into a real Buffer here
 *  sidesteps that type mismatch against @vercel/blob's PutBody union, and
 *  resumes are small enough that buffering in memory is a non-issue. */
export async function renderResumePdf(content: ResumeContent): Promise<Buffer> {
  const stream = await pdf(<ResumeDocument content={content} />).toBuffer();
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}
