
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";

const NotFoundEmployee = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-grow container mx-auto py-16 px-4 flex flex-col items-center justify-center">
        <h1 className="text-4xl font-bold mb-4">Employee Not Found</h1>
        <p className="text-xl text-muted-foreground mb-8 text-center max-w-md">
          We couldn't find the employee you're looking for. They might have been deleted or the ID is incorrect.
        </p>
        <Button asChild>
          <Link to="/">Return to Dashboard</Link>
        </Button>
      </main>

      <footer className="bg-muted py-6 mt-auto">
        <div className="container mx-auto text-center">
          <p className="text-sm text-muted-foreground">
            SDemployee © {new Date().getFullYear()} - Stress Detection System
          </p>
        </div>
      </footer>
    </div>
  );
};

export default NotFoundEmployee;
