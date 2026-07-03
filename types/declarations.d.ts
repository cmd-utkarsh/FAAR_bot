declare module "lucide-react" {
  import type { SVGProps } from "react";
  export interface LucideProps extends SVGProps<SVGSVGElement> {
    size?: number | string;
    absoluteStrokeWidth?: boolean;
  }
  export type LucideIcon = (props: LucideProps) => JSX.Element;
  export const XIcon: LucideIcon;
  export const CheckIcon: LucideIcon;
  export const ChevronDownIcon: LucideIcon;
  export const ChevronUpIcon: LucideIcon;
  export const ChevronLeftIcon: LucideIcon;
  export const ChevronRightIcon: LucideIcon;
  export const ChevronsUpDownIcon: LucideIcon;
  export const RefreshCwIcon: LucideIcon;
  export const SearchIcon: LucideIcon;
  export const SettingsIcon: LucideIcon;
  export const MenuIcon: LucideIcon;
  export const SendIcon: LucideIcon;
  export const SkipForwardIcon: LucideIcon;
  export const AlertTriangleIcon: LucideIcon;
  export const InboxIcon: LucideIcon;
  export const ZapIcon: LucideIcon;
  export const Loader2Icon: LucideIcon;
}
