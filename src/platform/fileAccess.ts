export async function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: name.endsWith(".json") ? "application/json;charset=utf-8" : "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function pickTextFile(kind: "json" | "csv"): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input"); input.type = "file";
    input.accept = kind === "json" ? ".json,application/json" : ".csv,text/csv,text/plain";
    input.oncancel = () => resolve(null);
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      const limitMb = kind === "json" ? 100 : 20;
      if (file.size > limitMb * 1_000_000) { reject(new Error(`Choose a ${kind.toUpperCase()} file smaller than ${limitMb} MB.`)); return; }
      try { resolve(await file.text()); } catch (error) { reject(error); }
    };
    input.click();
  });
}
