import React from "react";

import { cn } from "@/lib/utils";

type TableRootProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
  tableClassName?: string;
  tableStyle?: React.CSSProperties;
  minWidth?: string;
};

type TableBodyProps = React.HTMLAttributes<HTMLTableSectionElement> & {
  children: React.ReactNode;
  striped?: boolean;
  interactive?: boolean;
  virtualize?: boolean;
};

type TableAlign = "left" | "center" | "right";

type TableHeadProps = React.ThHTMLAttributes<HTMLTableCellElement> & {
  align?: TableAlign;
  numeric?: boolean;
};

type TableCellProps = React.TdHTMLAttributes<HTMLTableCellElement> & {
  align?: TableAlign;
  numeric?: boolean;
  muted?: boolean;
  nowrap?: boolean;
};

const alignClass = (align?: TableAlign, numeric?: boolean) => {
  if (numeric || align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
};

const TableRoot = ({ children, className, tableClassName, tableStyle, minWidth = "248px", ...props }: TableRootProps) => {
  return (
    <div
      className={cn("relative w-full overflow-auto rounded-lg border border-gray-alpha-400 bg-background-100", className)}
      {...props}
    >
      <table className={cn("w-full border-collapse text-sm font-sans text-gray-1000", tableClassName)} style={{ minWidth, ...tableStyle }}>
        {children}
      </table>
    </div>
  );
};

const Colgroup = ({ children }: { children: React.ReactNode }) => {
  return <colgroup>{children}</colgroup>;
};

const Col = ({ className }: { className?: string }) => {
  return <col className={className} />;
};

const Header = ({ children, className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => {
  return (
    <thead className={cn("border-b border-gray-alpha-400 bg-background-200 text-xs text-app-muted", className)} {...props}>
      {children}
    </thead>
  );
};

const Body = ({ children, striped, interactive, virtualize: _virtualize, className, ...props }: TableBodyProps) => {
  return (
    <>
      <tbody className="table-row h-3" />
      <tbody
        className={cn(
          striped && "[&_tr:where(:nth-child(odd))]:bg-background-200",
          interactive && "[&_tr:hover]:bg-gray-100",
          className
        )}
        {...props}
      >
        {children}
      </tbody>
    </>
  );
};

const Row = ({ children, className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => {
  return (
    <tr
      className={cn("border-b border-gray-alpha-400 last:border-b-0 [&_td:first-child]:rounded-l-[4px] [&_td:last-child]:rounded-r-[4px] transition-colors", className)}
      {...props}
    >
      {children}
    </tr>
  );
};

const Head = ({ children, className, align, numeric, ...props }: TableHeadProps) => {
  return (
    <th className={cn("h-10 px-5 align-middle font-semibold", alignClass(align, numeric), className)} {...props}>
      {children}
    </th>
  );
};

const Cell = ({ children, className, colSpan, align, numeric, muted, nowrap, ...props }: TableCellProps) => {
  return (
    <td
      className={cn(
        "px-5 py-2.5 align-middle",
        alignClass(align, numeric),
        muted && "text-app-muted",
        nowrap && "whitespace-nowrap",
        className
      )}
      colSpan={colSpan}
      {...props}
    >
      {children}
    </td>
  );
};

const Footer = ({ children, className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => {
  return (
    <tfoot className={cn("border-t border-gray-alpha-400 font-bold", className)} {...props}>
      {children}
    </tfoot>
  );
};

export const Table = Object.assign(TableRoot, {
  Colgroup,
  Col,
  Header,
  Body,
  Row,
  Head,
  Cell,
  Footer
});
