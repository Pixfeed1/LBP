import { TrendingUp, TrendingDown } from "lucide-react";
import { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  delta?: { value: string; trend: "up" | "down" | "neutral" };
  icon?: ReactNode;
  iconColor?: string;
  spark?: number[]; // valeurs 0-100
  empty?: boolean;
}

export function MetricCard({ label, value, delta, icon, iconColor = "text-primary", spark, empty }: MetricCardProps) {
  return (
    <div className="bg-white border border-border rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        {icon && <span className={iconColor}>{icon}</span>}
      </div>
      <div className={`text-3xl font-semibold tracking-tight ${empty ? "text-muted-foreground" : "text-foreground"}`}>
        {empty ? "—" : value}
      </div>
      {delta && !empty && (
        <div className={`flex items-center gap-1 text-xs mt-1.5 ${
          delta.trend === "up" ? "text-emerald-600" :
          delta.trend === "down" ? "text-red-600" :
          "text-muted-foreground"
        }`}>
          {delta.trend === "up" && <TrendingUp className="h-3 w-3" />}
          {delta.trend === "down" && <TrendingDown className="h-3 w-3" />}
          <span>{delta.value}</span>
        </div>
      )}
      {empty && <div className="text-xs text-muted-foreground mt-1.5">Aucune donnée</div>}
      {spark && spark.length > 0 && !empty && (
        <div className="flex items-end gap-0.5 h-6 mt-3">
          {spark.map((v, i) => (
            <div
              key={i}
              className="flex-1 bg-primary/20 rounded-sm"
              style={{ height: `${Math.max(v, 8)}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
