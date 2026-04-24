export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            QMS
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Quality Management System
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
