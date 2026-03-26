import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ background: "var(--color-background)" }}
    >
      <div className="text-center">
        <h1
          className="text-6xl font-bold mb-2"
          style={{ color: "var(--color-text-primary)" }}
        >
          404
        </h1>
        <p
          className="text-lg mb-4"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Page not found
        </p>
        <p
          className="text-sm mb-8"
          style={{ color: "var(--color-text-muted)" }}
        >
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Button onClick={() => navigate("/")} variant="outline">
          <Home size={16} className="mr-2" />
          Back to Home
        </Button>
      </div>
    </div>
  );
}