import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Email as Mail } from "@vibe/icons";

export default function VerifyRequestPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
          <Mail className="h-6 w-6 text-blue-600" />
        </div>
        <CardTitle>Check your email</CardTitle>
        <CardDescription>
          A sign-in link has been sent to your email address.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center text-sm text-gray-500">
        <p>
          Click the link in the email to complete your sign-in. If you
          don&apos;t see it, check your spam folder.
        </p>
      </CardContent>
    </Card>
  );
}
