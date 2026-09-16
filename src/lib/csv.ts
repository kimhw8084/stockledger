/** RFC 4180 fields, including escaped quotes, commas and newlines. */
export function parseCsvRows(csv: string, maxRows = 100_000): string[][] {
  if (csv.length > 20_000_000) throw new Error("CSV exceeds 20 MB.");
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false, closedQuote = false;
  const endField = () => { row.push(field); field = ""; closedQuote = false; };
  const endRow = () => { endField(); if (row.some(value => value !== "")) rows.push(row); row = []; if (rows.length > maxRows) throw new Error("CSV has too many rows."); };
  const input = csv.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') { quoted = false; closedQuote = true; }
      else field += char;
    } else if (char === ',' ) endField();
    else if (char === '\n' || char === '\r') { if (char === '\r' && input[i + 1] === '\n') i++; endRow(); }
    else if (char === '"' && field === "" && !closedQuote) quoted = true;
    else { if (closedQuote || char === '"') throw new Error("Malformed CSV quoting."); field += char; }
  }
  if (quoted) throw new Error("Unterminated CSV field.");
  if (field !== "" || row.length || closedQuote) endRow();
  if (rows.length && rows.some(value => value.length !== rows[0].length)) throw new Error("CSV rows have inconsistent columns.");
  return rows;
}
