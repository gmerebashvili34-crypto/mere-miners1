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

const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type SignInForm = z.infer<typeof signInSchema>;

export default function SignIn() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<SignInForm>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: SignInForm) => {
    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/auth/signin", data);
      
      toast({
        title: "Welcome back!",
        description: "Successfully signed in",
      });
      
      // Refresh user data
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      // Redirect to mining room
      window.location.href = "/";
    } catch (error: any) {
      toast({
        title: "Sign in failed",
        description: error.message || "Invalid email or password",
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
              Welcome Back
            </span>
          </CardTitle>
          <CardDescription>
            Sign in to your MereMiners account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

              <Button
                type="submit"
                className="w-full bg-gold-gradient text-black font-bold"
                disabled={isLoading}
                data-testid="button-signin"
              >
                {isLoading ? "Signing In..." : "Sign In"}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <div className="text-sm text-muted-foreground text-center">
            Don't have an account?{" "}
            <Link href="/signup">
              <span className="text-primary hover:underline cursor-pointer font-semibold">
                Sign Up
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
