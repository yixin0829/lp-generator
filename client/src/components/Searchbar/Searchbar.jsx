import { useLayoutEffect, useRef, useState } from "react";
import {
  EASE_OUT,
  cancelAnimationsWithin,
  onDone,
  play,
  prefersReducedMotion,
  useReducedMotion,
} from "../../motion/motion";

import "./Searchbar.scss";

export default function Searchbar({
  placeholder,
  placeholderExamples,
  onChange,
  onEnterKey,
  initialValue,
  style,
  className,
  maxLength,
  inputArgs,
}) {
  const [value, setValue] = useState(initialValue ?? "");
  const reducedMotion = useReducedMotion();
  const rotating = Boolean(placeholderExamples?.length) && !reducedMotion;
  const inputRef = useRef(null);
  const layerRef = useRef(null);

  // The layer is effect-owned: React renders it empty and this effect owns its
  // children. The real placeholder attribute never changes, so assistive tech
  // always hears the same hint.
  useLayoutEffect(() => {
    const input = inputRef.current;
    const layer = layerRef.current;
    if (!rotating || !input || !layer) return undefined;

    const show = (text) => {
      const span = document.createElement("span");
      span.textContent = text;
      layer.append(span);
      return span;
    };
    // Appended before paint: is-rotating already hides the native placeholder.
    let current = show(input.placeholder);
    let index = 0;
    let timer = 0;
    const idle = () =>
      !input.value && document.activeElement !== input && !document.hidden;
    const later = (ms) => {
      timer = setTimeout(rotate, ms);
    };

    function rotate() {
      if (!idle() || prefersReducedMotion()) {
        later(1500);
        return;
      }
      index = (index + 1) % placeholderExamples.length;
      const outgoing = current;
      current = show(placeholderExamples[index]);
      const exit = play(
        outgoing,
        [
          { opacity: 1, translate: "0 0", filter: "blur(0px)" },
          { opacity: 0, translate: "0 -6px", filter: "blur(3px)" },
        ],
        { duration: 180, easing: EASE_OUT, fill: "forwards" },
      );
      onDone(exit, () => outgoing.remove());
      play(
        current,
        [
          { opacity: 0, translate: "0 6px", filter: "blur(3px)" },
          { opacity: 1, translate: "0 0", filter: "blur(0px)" },
        ],
        { duration: 260, delay: 60, easing: EASE_OUT, fill: "backwards" },
      );
      later(3000);
    }

    later(2400);
    return () => {
      clearTimeout(timer);
      cancelAnimationsWithin(layer);
      layer.replaceChildren();
    };
  }, [rotating, placeholderExamples]);

  function onKeyDown(event) {
    if (event.key === "Enter" && !event.nativeEvent.isComposing && onEnterKey) {
      event.preventDefault();
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
    <div className={`search-field${rotating ? " is-rotating" : ""}`}>
      <input
        ref={inputRef}
        className={`text-input-search ${className ?? ""}`}
        style={style}
        onKeyDown={onKeyDown}
        value={value}
        placeholder={placeholder}
        onChange={onInputChange}
        {...inputArgs}
      />
      {rotating && (
        <span className="search-placeholder" aria-hidden="true" ref={layerRef} />
      )}
    </div>
  );
}
