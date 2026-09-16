import { useEffect, useState } from "react";
import { z } from "zod";
import store from "../platform/keyValueStore";
export function useSavedStringList(key: string, maximum: number) {
  const [value, setValue] = useState<string[]>([]); const [ready, setReady] = useState(false); const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    store.getItem(`stockledger.preference.${key}`).then(raw => {
      const parsed = raw === null ? [] : z.array(z.string().max(300)).max(maximum).parse(JSON.parse(raw));
      if (active) { setValue(parsed); setReady(true); }
    }).catch(() => { if (active) setError(`Saved ${key} preferences could not be loaded. Your workspace is intact.`); });
    return () => { active = false; };
  }, [key, maximum]);
  useEffect(() => {
    if (ready) store.setItem(`stockledger.preference.${key}`, JSON.stringify(value.slice(0, maximum))).catch(() => setError(`Could not save ${key} preferences.`));
  }, [key, maximum, ready, value]);
  return [value, setValue, error] as const;
}
