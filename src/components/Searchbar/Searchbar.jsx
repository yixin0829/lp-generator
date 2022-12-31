import React, { useState } from "react";

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
  const [value, setValue] = useState(initialValue ? initialValue : "");

  const onKeyPress = (target) => {
    if (target.charCode === 13) {
      setValue("");
      if (onEnterKey) onEnterKey(value);
    }
  };

  const onInputChange = (event) => {
    let value = event.target.value;
    if (maxLength) {
      if (value !== undefined && maxLength < value.length) {
        value = value.substring(0, value.length - 1);
      }
    }
    if (onChange) onChange(value);
    setValue(value);
  };

  return (
    <div style={{ width: "100%" }}>
      <input
        className={`text-input-search ${className}`}
        style={style}
        onKeyPress={onKeyPress}
        value={value}
        placeholder={placeholder}
        onChange={onInputChange}
        {...inputArgs}
      />
    </div>
  );
}
