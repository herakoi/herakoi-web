import { Label } from "#src/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#src/shared/components/ui/select";

type Plugin = {
  id: string;
  displayName: string;
};

type PluginSelectorProps = {
  label: string;
  plugins: Plugin[];
  activeId: string;
  onSelect: (id: string) => void;
};

/**
 * Plugin selector dropdown rendered above a settings panel.
 *
 * Always shown to indicate plugin system. When only one plugin is available,
 * shows a "More coming soon..." placeholder. When the user switches plugins,
 * the shell stops the engine, updates the active plugin ID, and restarts
 * with the new plugin.
 */
export const PluginSelector = ({ label, plugins, activeId, onSelect }: PluginSelectorProps) => {
  const hasMultiplePlugins = plugins.length > 1;

  return (
    <div className="flex items-center gap-3 pb-3 mb-4 border-b border-border/40">
      <Label htmlFor={`plugin-selector-${label}`} className="text-sm text-muted-foreground">
        Plugin:
      </Label>
      <Select value={activeId} onValueChange={onSelect}>
        <SelectTrigger
          id={`plugin-selector-${label}`}
          aria-label={`${label} plugin`}
          className="h-8 w-[200px]"
        >
          <SelectValue placeholder={`Select ${label} plugin`} />
        </SelectTrigger>
        <SelectContent position="popper">
          {plugins.map((plugin) => (
            <SelectItem key={plugin.id} value={plugin.id}>
              {plugin.displayName}
            </SelectItem>
          ))}
          {!hasMultiplePlugins && (
            <SelectItem value="_coming-soon" disabled>
              More coming soon...
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
};
