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
import { useState } from "react";
import { Loader2, Mail, MailCheck, MailX, Eye, EyeOff } from "lucide-react";

const smtpSchema = z.object({
  host: z.string().min(1, "Host is required"),
  port: z.number().min(1).max(65535),
  username: z.string(),
  password: z.string(),
  from_email: z.string().email().optional().or(z.literal("")),
  from_name: z.string(),
  use_tls: z.boolean(),
  enabled: z.boolean(),
});

type SmtpFormData = z.infer<typeof smtpSchema>;

export default function SmtpPage() {
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: QK.smtp(),
    queryFn: () => api.get<{ smtp: any }>("/admin/smtp"),
  });

  const form = useForm<SmtpFormData>({
    resolver: zodResolver(smtpSchema),
    defaultValues: {
      host: "",
      port: 587,
      username: "",
      password: "",
      from_email: "",
      from_name: "",
      use_tls: true,
      enabled: false,
    },
  });

  // Update form when data loads
  if (data?.smtp && !form.formState.isDirty) {
    form.reset({
      host: data.smtp.host || "",
      port: data.smtp.port || 587,
      username: data.smtp.username || "",
      password: data.smtp.password || "",
      from_email: data.smtp.from_email || "",
      from_name: data.smtp.from_name || "",
      use_tls: data.smtp.use_tls ?? true,
      enabled: data.smtp.enabled ?? false,
    });
  }

  const saveMutation = useMutation({
    mutationFn: (data: SmtpFormData) => api.put("/admin/smtp", data),
    onSuccess: () => {
      toast.success("SMTP settings saved");
      queryClient.invalidateQueries({ queryKey: QK.smtp() });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const testMutation = useMutation({
    mutationFn: (email: string) => api.post("/admin/smtp/test", { email }),
    onSuccess: (res: any) => {
      setTestResult({ success: true, message: "Test email sent successfully!" });
      toast.success("Test email sent");
    },
    onError: (err: any) => {
      setTestResult({ success: false, message: err.message || "Failed to send test email" });
      toast.error(err.message);
    },
  });

  if (isLoading) {
    return (
      <div className="p-8">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="SMTP Settings"
        description="Configure email delivery settings"
      />

      <div className="px-8 pb-8 space-y-6">
        {/* Status Badge */}
        <div className="flex items-center gap-2">
          {data?.smtp?.enabled ? (
            <span className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
              style={{ background: "var(--color-success-muted)", color: "var(--color-success)" }}>
              <MailCheck size={12} />
              Enabled
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
              style={{ background: "var(--color-danger-muted)", color: "var(--color-danger)" }}>
              <MailX size={12} />
              Disabled
            </span>
          )}
        </div>

        {/* SMTP Configuration */}
        <Card style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
          <CardHeader>
            <CardTitle style={{ color: "var(--color-text-primary)" }}>
              <Mail size={18} className="inline mr-2" />
              SMTP Configuration
            </CardTitle>
            <CardDescription style={{ color: "var(--color-text-secondary)" }}>
              Configure your SMTP server settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={form.handleSubmit((d) => saveMutation.mutate(d))}
              className="space-y-4"
            >
              {/* Enable/Disable */}
              <div className="flex items-center justify-between p-3 rounded-lg"
                style={{ background: "var(--color-surface-elevated)" }}>
                <div>
                  <Label className="font-medium">Enable SMTP</Label>
                  <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                    Enable email sending through SMTP
                  </p>
                </div>
                <Switch
                  checked={form.watch("enabled")}
                  onCheckedChange={(checked) => form.setValue("enabled", checked)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>SMTP Host</Label>
                  <Input {...form.register("host")} placeholder="smtp.example.com" />
                </div>
                <div className="grid gap-2">
                  <Label>Port</Label>
                  <Input
                    type="number"
                    {...form.register("port", { valueAsNumber: true })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Username</Label>
                  <Input {...form.register("username")} placeholder="user@example.com" />
                </div>
                <div className="grid gap-2">
                  <Label>Password</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      {...form.register("password")}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>From Email</Label>
                  <Input {...form.register("from_email")} placeholder="noreply@example.com" />
                </div>
                <div className="grid gap-2">
                  <Label>From Name</Label>
                  <Input {...form.register("from_name")} placeholder="Betterbase" />
                </div>
              </div>

              {/* TLS Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg"
                style={{ background: "var(--color-surface-elevated)" }}>
                <div>
                  <Label className="font-medium">Use TLS</Label>
                  <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                    Use TLS encryption for SMTP connection
                  </p>
                </div>
                <Switch
                  checked={form.watch("use_tls")}
                  onCheckedChange={(checked) => form.setValue("use_tls", checked)}
                />
              </div>

              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Test Email */}
        <Card style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
          <CardHeader>
            <CardTitle style={{ color: "var(--color-text-primary)" }}>Test Email</CardTitle>
            <CardDescription style={{ color: "var(--color-text-secondary)" }}>
              Send a test email to verify your SMTP configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
                className="flex-1"
              />
              <Button
                onClick={() => testMutation.mutate(testEmail)}
                disabled={!testEmail || testMutation.isPending}
              >
                {testMutation.isPending ? "Sending..." : "Send Test"}
              </Button>
            </div>
            {testResult && (
              <p
                className="mt-2 text-sm"
                style={{ color: testResult.success ? "var(--color-success)" : "var(--color-danger)" }}
              >
                {testResult.message}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}