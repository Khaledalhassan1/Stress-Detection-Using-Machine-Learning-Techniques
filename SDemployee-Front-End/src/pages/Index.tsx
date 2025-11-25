
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

const Index = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Just redirect to dashboard
    navigate("/", { replace: true });
  }, [navigate]);
  
  // Return null or a loading indicator while redirecting
  return <div className="flex justify-center items-center h-screen">Redirecting...</div>;
};

export default Index;
