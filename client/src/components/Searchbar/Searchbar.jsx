import { useState } from "react";

import "./Searchbar.scss";

export default function Searchbar({
  placeholder,
  onChange,
  onEnterKey,
  initialValue,
  style,
  className,
  maxLength,
  inputArgs,
}) {
  const [value, setValue] = useState(initialValue ?? "");

  function onKeyDown(event) {
    if (event.key === "Enter") {
      setValue("");
      onEnterKey?.(value);
    }
  }

  function onInputChange(event) {
    let nextValue = event.target.value;

    if (maxLength) {
      if (nextValue !== undefined && maxLength < nextValue.length) {
        nextValue = nextValue.substring(0, nextValue.length - 1);
      }
    }

    onChange?.(nextValue);
    setValue(nextValue);
  }

  return (
    <div style={{ width: "100%" }}>
      <input
        className={`text-input-search ${className ?? ""}`}
        style={style}
        onKeyDown={onKeyDown}
        value={value}
        placeholder={placeholder}
        onChange={onInputChange}
        {...inputArgs}
      />
    </div>
  );
}
