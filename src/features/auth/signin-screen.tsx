"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Loader2, LogIn, ChevronDown, ChevronRight, Wrench } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { navigate } from "@/store/router";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

type FormValues = z.infer<typeof schema>;

const DEMO_ACCOUNTS: { role: string; email: string; password: string }[] = [
  { role: "Admin", email: "admin@fixit.demo", password: "fixit-admin" },
  { role: "Customer", email: "customer@fixit.demo", password: "fixit-cust" },
  { role: "Technician", email: "tech@fixit.demo", password: "fixit-tech" },
];

function roleHome(role?: string) {
  if (role === "ADMIN") return "admin";
  if (role === "TECHNICIAN") return "technician";
  return "dashboard";
}

export function SignInScreen() {
  const [submitting, setSubmitting] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const res = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      });
      if (!res || res.error) {
        toast.error("Sign in failed", {
          description: "Email or password is incorrect.",
        });
        return;
      }
      // Fetch the session so role is available immediately.
      const r = await fetch("/api/auth/session").then((x) => x.json());
      const role = r?.user?.role as string | undefined;
      toast.success("Welcome back", {
        description: r?.user?.name || values.email,
      });
      navigate(roleHome(role));
    } catch (e: any) {
      toast.error("Sign in failed", { description: e?.message });
    } finally {
      setSubmitting(false);
    }
  }

  function fillDemo(email: string, password: string) {
    form.setValue("email", email);
    form.setValue("password", password);
    setDemoOpen(false);
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-10 sm:py-16">
      <button
        onClick={() => navigate("home")}
        className="mb-6 flex items-center gap-2 font-semibold"
        aria-label="FixIt home"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Wrench className="h-4 w-4" aria-hidden />
        </span>
        <span className="text-lg tracking-tight">FixIt</span>
      </button>

      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Sign in to FixIt</CardTitle>
          <CardDescription>
            Pick up where you left off — your equipment, diagnoses, and
            bookings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-4"
              noValidate
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        placeholder="••••••••"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={submitting} className="mt-2">
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <LogIn className="h-4 w-4" aria-hidden />
                )}
                Sign in
              </Button>
            </form>
          </Form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <button
              type="button"
              onClick={() => navigate("auth/signup")}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Create one
            </button>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 w-full">
        <Collapsible open={demoOpen} onOpenChange={setDemoOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between"
            >
              <span className="text-muted-foreground">Demo accounts</span>
              {demoOpen ? (
                <ChevronDown className="h-4 w-4" aria-hidden />
              ) : (
                <ChevronRight className="h-4 w-4" aria-hidden />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-2 bg-muted/30">
              <CardContent className="flex flex-col gap-2 py-3">
                <p className="text-xs text-muted-foreground">
                  Tap an account to autofill the form.
                </p>
                {DEMO_ACCOUNTS.map((a) => (
                  <button
                    key={a.email}
                    type="button"
                    onClick={() => fillDemo(a.email, a.password)}
                    className="flex flex-col items-start gap-0.5 rounded-md border border-border bg-background px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <span className="font-medium">{a.role}</span>
                    <span className="text-xs text-muted-foreground">
                      {a.email} · {a.password}
                    </span>
                  </button>
                ))}
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}

export default SignInScreen;
