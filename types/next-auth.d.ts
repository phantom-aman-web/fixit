import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: "CUSTOMER" | "TECHNICIAN" | "ADMIN";
    };
  }
  interface User {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    role: "CUSTOMER" | "TECHNICIAN" | "ADMIN";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "CUSTOMER" | "TECHNICIAN" | "ADMIN";
  }
}
