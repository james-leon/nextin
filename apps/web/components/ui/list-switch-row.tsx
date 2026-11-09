"use client";

import { useId, type ReactNode } from "react";
import { Switch } from "./switch";

/** Ligne de liste groupée avec interrupteur, libellé et aide associés au contrôle (accessibilité). */
export function ListSwitchRow({
  title,
  subtitle,
  icon,
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <li className="group/row flex w-full items-center gap-3 pl-4">
      {icon}
      <span className="relative flex min-h-11 flex-1 items-center gap-3 py-1 pr-4 list-separator">
        <span className="flex min-w-0 flex-1 flex-col">
          <label htmlFor={id} className="text-body">
            {title}
          </label>
          {subtitle ? (
            <span id={`${id}-hint`} className="text-subheadline text-label-secondary">
              {subtitle}
            </span>
          ) : null}
        </span>
        <Switch
          id={id}
          checked={checked}
          defaultChecked={defaultChecked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          aria-describedby={subtitle ? `${id}-hint` : undefined}
        />
      </span>
    </li>
  );
}
