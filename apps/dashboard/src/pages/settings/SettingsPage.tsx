import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { QK } from "@/lib/query-keys";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react";

const instanceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  public_url: z.string().url().optional().or(z.literal("")),
  contact_email: z.string().email().optional().or(z.literal("")),
});

const securitySchema = z.object({
  log_retention_days: z.number().min(1).max(365),
  max_sessions_per_user: z.number().min(1).max(100),
  ip_allowlist: z.string(),
  cors_origins: z.string(),
});

type InstanceFormData = z.infer<typeof instanceSchema>;
type SecurityFormData = z.infer<typeof securitySchema>;

export default function SettingsPage() {
  const queryClient = useQueryClient();

  // Instance info
  const { data: instanceData, isLoading: instanceLoading } = useQuery({
    queryKey: QK.instance(),
    queryFn: () => api.get<{ instance: any }>("/admin/instance"),
  });

  // Health status
  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: QK.health(),
    queryFn: () => api.get<{ status: string; latency_ms?: number; uptime_seconds?: number }>("/admin/instance/health"),
    refetchInterval: 30_000,
  });

  const instanceForm = useForm<InstanceFormData>({
    resolver: zodResolver(instanceSchema),
    defaultValues: {
      name: "",
      public_url: "",
      contact_email: "",
    },
  });

  const securityForm = useForm<SecurityFormData>({
    resolver: zodResolver(securitySchema),
    defaultValues: {
      log_retention_days: 30,
      max_sessions_per_user: 5,
      ip_allowlist: "",
      cors_origins: "",
    },
  });

  useEffect(() => {
    if (instanceData?.instance) {
      instanceForm.reset({
        name: instanceData.instance.name || "",
        public_url: instanceData.instance.public_url || "",
        contact_email: instanceData.instance.contact_email || "",
      });
    }
  }, [instanceData, instanceForm]);

  useEffect(() => {
    if (instanceData?.instance) {
      securityForm.reset({
        log_retention_days: instanceData.instance.log_retention_days || 30,
        max_sessions_per_user: instanceData.instance.max_sessions_per_user || 5,
        ip_allowlist: instanceData.instance.ip_allowlist?.join(", ") || "",
        cors_origins: instanceData.instance.cors_origins?.join(", ") || "",
      });
    }
  }, [instanceData, securityForm]);

  const instanceMutation = useMutation({
    mutationFn: (data: InstanceFormData) => api.patch("/admin/instance", data),
    onSuccess: () => {
      toast.success("Instance settings saved");
      queryClient.invalidateQueries({ queryKey: QK.instance() });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const securityMutation = useMutation({
    mutationFn: (data: SecurityFormData) => api.patch("/admin/instance/security", {
      ...data,
      ip_allowlist: data.ip_allowlist.split(",").map((s) => s.trim()).filter(Boolean),
      cors_origins: data.cors_origins.split(",").map((s) => s.trim()).filter(Boolean),
    }),
    onSuccess: () => {
      toast.success("Security settings saved");
      queryClient.invalidateQueries({ queryKey: QK.instance() });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const [resetConfirm, setResetConfirm] = useState("");
  const [showResetDialog, setShowResetDialog] = useState(false);

  const resetMutation = useMutation({
    mutationFn: () => api.post("/admin/instance/reset"),
    onSuccess: () => {
      toast.success("Instance reset initiated");
      setShowResetDialog(false);
      setResetConfirm("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (instanceLoading) {
    return (
      <div className="p-8">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage your Betterbase instance settings"
      />

      <div className="px-8 pb-8 space-y-6">
        {/* Instance Info */}
        <Card style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
          <CardHeader>
            <CardTitle style={{ color: "var(--color-text-primary)" }}>Instance Information</CardTitle>
            <CardDescription style={{ color: "var(--color-text-secondary)" }}>
              Basic information about your Betterbase instance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={instanceForm.handleSubmit((d) => instanceMutation.mutate(d))}
              className="space-y-4"
            >
              <div className="grid gap-2">
                <Label>Instance Name</Label>
                <Input {...instanceForm.register("name")} placeholder="My Betterbase" />
              </div>
              <div className="grid gap-2">
                <Label>Public URL</Label>
                <Input {...instanceForm.register("public_url")} placeholder="https://betterbase.example.com" />
              </div>
              <div className="grid gap-2">
                <Label>Contact Email</Label>
                <Input {...instanceForm.register("contact_email")} placeholder="admin@example.com" />
              </div>
              <Button type="submit" disabled={instanceMutation.isPending}>
                {instanceMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Health Status */}
        <Card style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
          <CardHeader>
            <CardTitle style={{ color: "var(--color-text-primary)" }}>Health Status</CardTitle>
            <CardDescription style={{ color: "var(--color-text-secondary)" }}>
              Current system health and uptime
            </CardDescription>
          </CardHeader>
          <CardContent>
            {healthLoading ? (
              <Loader2 className="animate-spin" />
            ) : healthData?.status === "healthy" ? (
              <div className="flex items-center gap-4">
                <CheckCircle size={20} style={{ color: "var(--color-success)" }} />
                <div>
                  <p style={{ color: "var(--color-text-primary)" }}>Healthy</p>
                  <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                    Latency: {healthData.latency_ms}ms | Uptime: {Math.floor((healthData.uptime_seconds || 0) / 3600)}h
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <AlertTriangle size={20} style={{ color: "var(--color-danger)" }} />
                <p style={{ color: "var(--color-text-primary)" }}>Unhealthy</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
          <CardHeader>
            <CardTitle style={{ color: "var(--color-text-primary)" }}>Security</CardTitle>
            <CardDescription style={{ color: "var(--color-text-secondary)" }}>
              Configure security settings for your instance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={securityForm.handleSubmit((d) => securityMutation.mutate(d))}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Log Retention (days)</Label>
                  <Input
                    type="number"
                    {...securityForm.register("log_retention_days", { valueAsNumber: true })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Max Sessions Per User</Label>
                  <Input
                    type="number"
                    {...securityForm.register("max_sessions_per_user", { valueAsNumber: true })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>IP Allowlist (comma-separated)</Label>
                <Input {...securityForm.register("ip_allowlist")} placeholder="192.168.1.0/24, 10.0.0.0/8" />
              </div>
              <div className="grid gap-2">
                <Label>CORS Origins (comma-separated)</Label>
                <Input {...securityForm.register("cors_origins")} placeholder="https://app.example.com, https://admin.example.com" />
              </div>
              <Button type="submit" disabled={securityMutation.isPending}>
                {securityMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card style={{ background: "var(--color-surface)", borderColor: "var(--color-danger)" }}>
          <CardHeader>
            <CardTitle style={{ color: "var(--color-danger)" }}>Danger Zone</CardTitle>
            <CardDescription style={{ color: "var(--color-text-secondary)" }}>
              Irreversible actions that affect your instance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p style={{ color: "var(--color-text-primary)" }}>Factory Reset</p>
                <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                  Reset the instance to factory settings. This cannot be undone.
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setShowResetDialog(true)}
              >
                Reset Instance
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Reset Confirmation Dialog */}
        {showResetDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.7)" }}
            onClick={() => setShowResetDialog(false)}
          >
            <div
              className="w-full max-w-md rounded-xl p-6"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--color-danger)" }}>
                Factory Reset
              </h3>
              <p className="mb-4" style={{ color: "var(--color-text-secondary)" }}>
                This will permanently delete all data and reset the instance. This action cannot be undone.
              </p>
              <p className="mb-4 text-sm" style={{ color: "var(--color-text-muted)" }}>
                Type <strong style={{ color: "var(--color-text-primary)" }}>{instanceData?.instance?.name || "instance"}</strong> to confirm:
              </p>
              <Input
                value={resetConfirm}
                onChange={(e) => setResetConfirm(e.target.value)}
                placeholder={instanceData?.instance?.name || "instance"}
                className="mb-4"
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowResetDialog(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={resetConfirm !== instanceData?.instance?.name || resetMutation.isPending}
                  onClick={() => resetMutation.mutate()}
                >
                  {resetMutation.isPending ? "Resetting..." : "Reset Instance"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}