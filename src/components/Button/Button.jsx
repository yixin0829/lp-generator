import React from "react";

import "./Button.scss";

export default function Button({
  label,
  onClick,
  isSecondary,
  style,
  icon,
  inline,
  className,
}) {
  return (
    <div
      onClick={onClick}
      style={{
        ...style,
        ...{ display: inline === true ? "inline-block" : "flex" },
      }}
      className={`${isSecondary ? "secondary-button" : "primary-button"} ${
        icon ? "icon-button" : ""
      } ${className}`}
    >
      {label !== undefined ? <>{label}</> : <></>}
      {icon !== undefined ? (
        <img src={icon} className="button-icon" alt="" />
      ) : (
        <></>
      )}
    </div>
  );
}
