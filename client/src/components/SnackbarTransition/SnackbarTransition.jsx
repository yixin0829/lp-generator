import { cloneElement, useCallback, useRef } from "react";
import { SnackbarProvider, Transition } from "notistack";

import {
  EASE_OUT,
  SPRING,
  SPRING_MS,
  cancelAnimationsWithin,
  play,
  prefersReducedMotion,
  readOpacity,
  useReducedMotion,
} from "../../motion/motion";

export function MotionSnackbarProvider({ children }) {
  const reduced = useReducedMotion();
  return (
    <SnackbarProvider
      TransitionComponent={SnackbarTransition}
      // notistack hides and collapses a snack after the exit timeout, so it must match the exit.
      transitionDuration={
        reduced ? { enter: 150, exit: 100 } : { enter: 600, exit: 180 }
      }
    >
      {children}
    </SnackbarProvider>
  );
}

// Toasts rise from below on the spring and leave faster, from wherever they are.
// Built on notistack's own Transition, as its Slide is; the lifecycle callbacks
// pass through, because notistack closes and removes snacks from them.
export default function SnackbarTransition({
  children,
  in: inProp,
  timeout,
  style,
  // Slide's prop; the toasts always rise from below.
  direction,
  onEnter,
  onEntered,
  onExit,
  onExited,
  ...other
}) {
  const nodeRef = useRef(null);
  const childRef = children.props.ref;
  const handleRef = useCallback(
    (node) => {
      nodeRef.current = node;
      if (typeof childRef === "function") childRef(node);
      else if (childRef) childRef.current = node;
    },
    [childRef],
  );

  const handleEnter = (node, isAppearing) => {
    if (prefersReducedMotion()) {
      play(node, [{ opacity: 0 }, { opacity: 1 }], {
        duration: 150,
        easing: "ease",
      });
    } else {
      play(
        node,
        [
          { transform: "translateY(calc(100% + 24px))" },
          { transform: "translateY(0)" },
        ],
        { duration: SPRING_MS, easing: SPRING },
      );
      play(node, [{ opacity: 0 }, { opacity: 1 }], {
        duration: 180,
        easing: "ease",
      });
    }
    onEnter?.(node, isAppearing);
  };

  const handleExit = (node) => {
    // A fourth toast pushes the oldest out while it may still be rising: read before cancelling.
    const fromOpacity = readOpacity(node);
    const fromY = prefersReducedMotion() ? 0 : translateY(node);
    cancelAnimationsWithin(node);
    if (prefersReducedMotion()) {
      play(node, [{ opacity: fromOpacity }, { opacity: 0 }], {
        duration: 100,
        easing: "ease",
        fill: "forwards",
      });
    } else {
      play(
        node,
        [
          { transform: `translateY(${fromY}px)`, opacity: fromOpacity },
          {
            transform: `translateY(${node.offsetHeight + 24}px)`,
            opacity: 0,
          },
        ],
        { duration: 180, easing: EASE_OUT, fill: "forwards" },
      );
    }
    onExit?.(node);
  };

  return (
    <Transition
      appear
      in={inProp}
      timeout={timeout}
      nodeRef={nodeRef}
      onEnter={handleEnter}
      onEntered={onEntered}
      onExit={handleExit}
      onExited={onExited}
      {...other}
    >
      {(state, childProps) =>
        cloneElement(children, {
          ref: handleRef,
          style: {
            visibility: state === "exited" && !inProp ? "hidden" : undefined,
            ...style,
            ...children.props.style,
          },
          ...childProps,
        })
      }
    </Transition>
  );
}

function translateY(node) {
  const { transform } = getComputedStyle(node);
  if (!transform || transform === "none") return 0;
  try {
    return new DOMMatrixReadOnly(transform).f;
  } catch {
    return 0;
  }
}
