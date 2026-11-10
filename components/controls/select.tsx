"use client";
import {
  Children,
  Fragment,
  isValidElement,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

type Choice = { value: string; label: ReactNode; disabled?: boolean };
function choices(children: ReactNode): Choice[] {
  return Children.toArray(children).flatMap((child) => {
    if (
      !isValidElement<{
        value?: string | number;
        children?: ReactNode;
        disabled?: boolean;
      }>(child)
    )
      return [];
    if (child.type === Fragment) return choices(child.props.children);
    return [
      {
        value: String(child.props.value ?? ""),
        label: child.props.children,
        disabled: child.props.disabled,
      },
    ];
  });
}
const EMPTY = "__splitflow_empty_option__";
/** Shared visual select. Retains existing controlled values and native form submission. */
export function Select({
  children,
  value,
  defaultValue,
  onChange,
  className = "",
  name,
  disabled,
  required,
  id,
  "aria-label": label,
}: {
  children: ReactNode;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (event: {
    target: { value: string };
    currentTarget: { value: string; form: HTMLFormElement | null };
  }) => void;
  className?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  "aria-label"?: string;
}) {
  const options = choices(children);
  const [local, setLocal] = useState(
    String(defaultValue ?? options[0]?.value ?? ""),
  );
  const selected = String(value ?? local);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <SelectPrimitive.Root
      value={selected || EMPTY}
      disabled={disabled}
      required={required}
      onValueChange={(next) => {
        const nextValue = next === EMPTY ? "" : next;
        setLocal(nextValue);
        onChange?.({
          target: { value: nextValue },
          currentTarget: {
            value: nextValue,
            form: trigger.current?.form ?? null,
          },
        });
      }}
    >
      {name && (
        <input type="hidden" name={name} value={selected} disabled={disabled} />
      )}
      <SelectPrimitive.Trigger
        ref={trigger}
        id={id}
        aria-label={label}
        className={`sf-select ${className}`}
      >
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon asChild>
          <ChevronDown size={14} aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          className="sf-select-menu"
        >
          <SelectPrimitive.ScrollUpButton className="sf-select-scroll">
            <ChevronUp size={14} />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="sf-select-options">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value || EMPTY}
                disabled={option.disabled}
                className="sf-select-option"
              >
                <SelectPrimitive.ItemText>
                  {option.label}
                </SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator>
                  <Check size={15} aria-hidden="true" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="sf-select-scroll">
            <ChevronDown size={14} />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
