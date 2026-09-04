import type { ReactNode } from "react";

/** Semantic status. Independent of the brand accent on purpose. */
export type Tone = "info" | "success" | "warning" | "danger";

export const toneVars = (tone: Tone = "info") => ({
  fg: `var(--tone-${tone})`,
  wash: `var(--tone-${tone}-wash)`,
});

export interface ButtonVariantProps {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}

export interface BadgeProps {
  children: ReactNode;
  tone?: Tone;
}

export interface ChipProps {
  children: ReactNode;
  selected?: boolean;
  /** show the remove affordance (kept separate from the handler so a
      server-rendered preview can display it without passing a function) */
  removable?: boolean;
  onRemove?: () => void;
}

export interface AlertProps {
  title: string;
  children?: ReactNode;
  tone?: Tone;
}

export interface ToastProps {
  title: string;
  message?: string;
  tone?: Tone;
}

export interface ProgressProps {
  /** 0–100 */
  value: number;
  label?: string;
}

export interface PaginationProps {
  page: number;
  pages: number;
}

export interface ListGroupProps {
  items: { title: string; meta?: string }[];
}

export interface ContentCardProps {
  title: string;
  body: string;
  tag?: string;
  /** name used to seed the placeholder photo */
  imageSeed?: string;
}

export interface ModalProps {
  title: string;
  children?: ReactNode;
  onClose?: () => void;
}

export interface PopoverProps {
  label: string;
  children?: ReactNode;
}

export interface QA {
  q: string;
  a: string;
}

export interface AccordionProps {
  items: QA[];
}

export interface CarouselProps {
  items: { title: string; subtitle?: string }[];
}

export interface DropdownProps {
  label: string;
  options: string[];
}
