import * as React from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { categoryIcon, groupCategories } from "@/lib/categories";

export type CategoryLite = { id: string; name: string };

type Props = {
  value: string; // "" or "none" means uncategorised
  onChange: (v: string) => void;
  categories: CategoryLite[];
  includeNone?: boolean;
  placeholder?: string;
  triggerClassName?: string;
};

/** Grouped, icon-prefixed category selector. */
export function CategorySelect({ value, onChange, categories, includeNone = true, placeholder = "Category", triggerClassName }: Props) {
  const groups = React.useMemo(() => groupCategories(categories), [categories]);
  const selected = categories.find(c => c.id === value);
  return (
    <Select value={value || "none"} onValueChange={(v) => onChange(v === "none" ? "" : v)}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder={placeholder}>
          {selected ? (
            <span className="flex items-center gap-2">
              <span aria-hidden>{categoryIcon(selected.name)}</span>
              <span className="truncate">{selected.name}</span>
            </span>
          ) : includeNone ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <span aria-hidden>❓</span><span>Uncategorised</span>
            </span>
          ) : null}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[360px]">
        {includeNone && (
          <>
            <SelectItem value="none">
              <span className="flex items-center gap-2"><span aria-hidden>❓</span>Uncategorised</span>
            </SelectItem>
            <SelectSeparator />
          </>
        )}
        {groups.map((g, i) => (
          <React.Fragment key={g.group}>
            {i > 0 && <SelectSeparator />}
            <SelectGroup>
              <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">{g.group}</SelectLabel>
              {g.items.map(c => (
                <SelectItem key={c.id} value={c.id} className="data-[state=checked]:bg-accent/60">
                  <span className="flex items-center gap-2">
                    <span aria-hidden>{categoryIcon(c.name)}</span>
                    <span className="truncate">{c.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          </React.Fragment>
        ))}
      </SelectContent>
    </Select>
  );
}
