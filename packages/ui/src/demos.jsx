"use client";

import { useState } from "react";
import { SearchSelect } from "./SearchSelect";
import { TimePicker, TimePickerInput } from "./TimePicker";

/*
 * Working demos for the component catalogue. They keep their own choice (state), so they are client components — kept out of the registry,
 * which the storefront's server pages import.
 */

/** The catalogue's working demo of the searchable dropdown: it keeps its own choice, so it can be tried out. */
export function SearchableDemo({ label, options = [], value: valueProp, onChange, fullWidth = true }) {
  const list = options.map((o) => (o !== null && typeof o === "object" ? o : { value: o, label: String(o) }));
  const [chosen, setChosen] = useState(valueProp ?? "");
  return (
    <div style={{ minWidth: 240 }}>
      <SearchSelect label={label} options={list} value={valueProp !== undefined ? valueProp : chosen} fullWidth={fullWidth} placeholder="Choose…" onChange={(val) => (valueProp !== undefined ? onChange?.(val) : setChosen(val))} />
    </div>
  );
}

/** Working demos of the time pickers (they keep their own choice so the catalogue can show them in use). */
export function TimePickerDemo({ inline = false }) {
  const [value, setValue] = useState("19:00");
  const props = { value, onChange: setValue, step: 30, min: "11:00", max: "23:00" };
  return inline ? (
    <div style={{ width: 320, padding: 12, border: "1px solid var(--color-border)", borderRadius: 14, background: "var(--color-surface)" }}>
      <TimePicker {...props} groupByPeriod />
    </div>
  ) : (
    <div style={{ width: 240 }}>
      <TimePickerInput {...props} label="Select time" />
    </div>
  );
}

