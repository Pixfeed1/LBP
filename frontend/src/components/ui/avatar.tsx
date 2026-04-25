"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Avatar = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full bg-primary/10", className)} {...props} />
);

export const AvatarFallback = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex h-full w-full items-center justify-center text-sm font-medium text-primary", className)} {...props} />
);
