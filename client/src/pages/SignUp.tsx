import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { LogIn } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

const signUpSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  referralCode: z.string().optional(),
});

type SignUpForm = z.infer<typeof signUpSchema>;

export default function SignUp() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<SignUpForm>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      referralCode: "",
    },
  });

  const onSubmit = async (data: SignUpForm) => {
    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/auth/signup", data);
      
      toast({
        title: "Account created!",
        description: "Welcome to MereMiners",
      });
      
      // Refresh user data
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      // Redirect to mining room
      window.location.href = "/";
    } catch (error: any) {
      toast({
        title: "Sign up failed",
        description: error.message || "Failed to create account",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-accent/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-display font-bold">
            <span className="bg-gold-gradient bg-clip-text text-transparent">
              Join MereMiners
            </span>
          </CardTitle>
          <CardDescription>
            Create your account and start mining MERE
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John" {...field} data-testid="input-firstname" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" {...field} data-testid="input-lastname" />
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
                      <Input type="email" placeholder="john@example.com" {...field} data-testid="input-email" />
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
                      <Input type="password" placeholder="••••••••" {...field} data-testid="input-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="referralCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Referral Code (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="MERE123456" {...field} data-testid="input-referral" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full bg-gold-gradient text-black font-bold"
                disabled={isLoading}
                data-testid="button-signup"
              >
                {isLoading ? "Creating Account..." : "Sign Up"}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <div className="text-sm text-muted-foreground text-center">
            Already have an account?{" "}
            <Link href="/signin">
              <span className="text-primary hover:underline cursor-pointer font-semibold">
                Sign In
              </span>
            </Link>
          </div>
          <div className="text-xs text-muted-foreground text-center">
            Or continue with Replit Auth{" "}
            <a href="/api/login" className="text-primary hover:underline">
              here
            </a>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
