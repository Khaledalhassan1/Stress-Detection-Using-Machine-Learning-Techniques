
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Activity } from "lucide-react";

const Header = () => {
  return (
    <header className="bg-primary text-primary-foreground py-4 px-6 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold flex items-center gap-2">
          <Activity size={24} />
          <span>SDemployee</span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link to="/departments">
            <Button variant="secondary">Departments</Button>
          </Link>
          <Link to="/add-employee">
            <Button variant="secondary">Add Employee</Button>
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default Header;
