"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Loader2, UserPlus, Wrench } from "lucide-react";

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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/hooks/use-api";
import { navigate } from "@/store/router";

const SUBCITIES = [
  "Bole",
  "Kazanchis",
  "Piazza",
  "Arada",
  "Kirkos",
  "Yeka",
  "Lideta",
  "Nifas Silk-Lafto",
  "Kolfe Keranio",
  "Gulele",
];

const schema = z
  .object({
    name: z.string().min(2, "Name is too short").max(80),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(6, "At least 6 characters").max(100),
    role: z.enum(["CUSTOMER", "TECHNICIAN"]),
    subCity: z.string().optional(),
  })
  .refine((d) => d.role !== "CUSTOMER" || !!d.subCity, {
    path: ["subCity"],
    message: "Pick your Addis Ababa sub-city",
  });

type FormValues = z.infer<typeof schema>;

function roleHome(role: string) {
  if (role === "ADMIN") return "admin";
  if (role === "TECHNICIAN") return "technician";
  return "dashboard";
}

export function SignUpScreen() {
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "CUSTOMER",
      subCity: undefined,
    },
  });

  const role = form.watch("role");

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          password: values.password,
          role: values.role,
          subCity: values.role === "CUSTOMER" ? values.subCity : undefined,
        }),
      });

      const res = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      });
      if (!res || res.error) {
        toast.success("Account created", {
          description: "Please sign in to continue.",
        });
        navigate("auth/signin");
        return;
      }
      toast.success("Welcome to FixIt", { description: values.name });
      navigate(roleHome(values.role));
    } catch (e: any) {
      toast.error("Sign up failed", { description: e?.message });
    } finally {
      setSubmitting(false);
    }
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
          <CardTitle className="text-xl">Create your FixIt account</CardTitle>
          <CardDescription>
            Diagnose, troubleshoot, and book verified Addis Ababa technicians.
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
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="name"
                        placeholder="Sara Ahmed"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                        autoComplete="new-password"
                        placeholder="At least 6 characters"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>I am signing up as</FormLabel>
                    <FormControl>
                      <RadioGroup
                        value={field.value}
                        onValueChange={field.onChange}
                        className="grid grid-cols-2 gap-3"
                      >
                        <label
                          htmlFor="role-customer"
                          className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-background p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                        >
                          <RadioGroupItem
                            id="role-customer"
                            value="CUSTOMER"
                            className="mt-0.5"
                          />
                          <div>
                            <div className="text-sm font-medium">Customer</div>
                            <div className="text-xs text-muted-foreground">
                              Diagnose and book repairs
                            </div>
                          </div>
                        </label>
                        <label
                          htmlFor="role-tech"
                          className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-background p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                        >
                          <RadioGroupItem
                            id="role-tech"
                            value="TECHNICIAN"
                            className="mt-0.5"
                          />
                          <div>
                            <div className="text-sm font-medium">
                              Technician
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Offer repair services
                            </div>
                          </div>
                        </label>
                      </RadioGroup>
                    </FormControl>
                    {role === "TECHNICIAN" && (
                      <FormDescription>
                        Technician accounts start as{" "}
                        <span className="font-medium">Pending</span> until an
                        admin approves them.
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {role === "CUSTOMER" && (
                <FormField
                  control={form.control}
                  name="subCity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Addis Ababa sub-city</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select your area" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SUBCITIES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <Button type="submit" disabled={submitting} className="mt-2">
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <UserPlus className="h-4 w-4" aria-hidden />
                )}
                Create account
              </Button>
            </form>
          </Form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => navigate("auth/signin")}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Sign in
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SignUpScreen;
