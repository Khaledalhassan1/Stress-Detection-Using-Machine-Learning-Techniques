import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import StressBadge from "@/components/StressBadge";
import { Employee, StressLevelType } from "@/types/employee";
import Header from "@/components/Header";
import { Users, Send, MessageCircle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { DEPARTMENTS } from "@/types/department";
import { supabase } from "@/lib/supabaseClient";

async function sendMessageToBot(text: string): Promise<string> {
  const res = await fetch(
    "https://soledad-inconvertible-remotely.ngrok-free.dev/chat",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    }
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Bot request failed: ${res.status} ${txt}`);
  }

  const data = await res.json();
  return data.reply || "Sorry, I couldn't understand that.";
}

const Dashboard = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    { from: "user" | "bot"; text: string }[]
  >([
    {
      from: "bot",
      text: "Hi! 👋 How can I help you with People Pulse today?",
    },
  ]);

  useEffect(() => {
    
    const loadEmployees = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("employees")
          .select("*");

        if (error) {
          console.error("Error fetching employees:", error);
          toast.error("Failed to load employee data");
          setEmployees([]);
          return;
        }

        if (data) {
          const mapped: Employee[] = data.map((e: any) => ({
            id: e.id,
            name: e.name,
            age: e.age,
            gender: e.gender,
            department: e.department,
            photo: e.photo,
            stressLevel:
              (e.stress_level as StressLevelType) ?? "Not Measured Yet",
          }));
          setEmployees(mapped);
        }
      } catch (err) {
        console.error("Error loading employees:", err);
        toast.error("Failed to load employee data");
        setEmployees([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadEmployees();
  }, []);

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    const message = chatInput.trim();

    setChatMessages((prev) => [...prev, { from: "user", text: message }]);
    setChatInput("");
    setIsBotTyping(true);

    try {
      const reply = await sendMessageToBot(message);

      setChatMessages((prev) => [
        ...prev,
        {
          from: "bot",
          text: reply,
        },
      ]);
    } catch (error: any) {
      console.error("Error talking to bot:", error);
      toast.error("Failed to contact assistant. Please try again.");
      setChatMessages((prev) => [
        ...prev,
        {
          from: "bot",
          text: "Sorry, something went wrong while contacting the assistant.",
        },
      ]);
    } finally {
      setIsBotTyping(false);
    }
  };

  const filteredEmployees = employees.filter(
    (employee) =>
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const departmentData = DEPARTMENTS.map((dept) => ({
    name: dept,
    count: employees.filter((emp) => emp.department === dept).length,
  }));

  const stressData = [
    {
      name: "Stress",
      value: employees.filter((emp) => emp.stressLevel === "Stress").length,
    },
    {
      name: "Not Stress",
      value: employees.filter((emp) => emp.stressLevel === "Not Stress").length,
    },
    {
      name: "Not Measured Yet",
      value: employees.filter(
        (emp) => emp.stressLevel === "Not Measured Yet"
      ).length,
    },
  ];

  const COLORS = [
    "hsl(var(--destructive))", // Stress
    "hsl(var(--primary))", // Not Stress
    "hsl(var(--muted-foreground))", // Not Measured Yet
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-grow container mx-auto py-8 px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Home</h1>
          <p className="text-muted-foreground">
            Manage and view all employee information
          </p>
        </div>

        {!isLoading && (
          <>
            <Card className="mb-6 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-4 rounded-full bg-primary/10">
                    <Users className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Total Employees
                    </p>
                    <p className="text-3xl font-bold">{employees.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2 mb-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Employees by Department
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={departmentData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                      />
                      <XAxis
                        dataKey="name"
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fill: "hsl(var(--foreground))" }}
                      />
                      <YAxis
                        domain={[0, 6]}
                        allowDecimals={false}
                        tickCount={7}
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fill: "hsl(var(--foreground))" }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          color: "hsl(var(--card-foreground))",
                        }}
                      />
                      <Bar
                        dataKey="count"
                        fill="hsl(var(--primary))"
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Stress Status Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={stressData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={80}
                        fill="hsl(var(--primary))"
                        dataKey="value"
                      >
                        {stressData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          color: "hsl(var(--card-foreground))",
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        <div className="mb-6">
          <Input
            placeholder="Search employees by name or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <p>Loading employees...</p>
          </div>
        ) : employees.length === 0 ? (
          <Card className="bg-muted/50">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <h3 className="text-xl font-medium mb-2">No employees found</h3>
              <p className="text-muted-foreground mb-4">
                Add your first employee to get started
              </p>
              <Link to="/add-employee">
                <Button>Add Employee</Button>
              </Link>
            </CardContent>
          </Card>
        ) : filteredEmployees.length === 0 ? (
          <Card className="bg-muted/50">
            <CardContent className="py-8 text-center">
              <p>No employees match your search</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredEmployees.map((employee) => (
              <Card
                key={employee.id}
                className="overflow-hidden animate-fade-in"
              >
                <CardHeader className="p-0">
                  <div className="aspect-video w-full overflow-hidden bg-muted">
                    <img
                      src={employee.photo || "/placeholder.svg"}
                      alt={employee.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = "/placeholder.svg";
                      }}
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <Link to={`/employee/${employee.id}`}>
                      <h3 className="font-semibold text-xl hover:text-primary hover:underline">
                        {employee.name}
                      </h3>
                    </Link>
                    <StressBadge level={employee.stressLevel} />
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Age: {employee.age}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Department: {employee.department}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {isChatOpen && (
          <div
            className="
              fixed bottom-4 right-4 z-50
              w-[90vw] max-w-[600px]
              h-[75vh]
            "
          >
            <Card className="shadow-2xl border h-full flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-sm font-semibold md:text-base">
                  People Pulse Assistant
                </CardTitle>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </CardHeader>

              <CardContent className="flex flex-col gap-3 flex-1">
                <div className="flex-1 min-h-0 overflow-y-auto space-y-2 text-sm pr-1">
                  {chatMessages.map((m, idx) => (
                    <div
                      key={idx}
                      className={`flex ${
                        m.from === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`rounded-lg px-3 py-2 max-w-[80%] ${
                          m.from === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  ))}

                  {isBotTyping && (
                    <div className="flex justify-start">
                      <div className="rounded-lg px-3 py-2 max-w-[80%] bg-muted text-foreground text-xs italic">
                        Assistant is typing...
                      </div>
                    </div>
                  )}
                </div>

                <form
                  className="flex gap-2 pt-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                >
                  <Input
                    placeholder="Ask something..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="text-sm md:text-base"
                  />
                  <Button type="submit" size="icon" disabled={isBotTyping}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <button
        onClick={() => setIsChatOpen(true)}
        className="
          fixed bottom-6 right-6 z-40
          bg-primary text-primary-foreground
          p-4 rounded-full shadow-lg
          hover:scale-110 transition-transform
          flex items-center justify-center
        "
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      <footer className="bg-muted py-6 mt-auto">
        <div className="container mx-auto text-center">
          <p className="text-sm text-muted-foreground">
            People Pulse © {new Date().getFullYear()} - Employee Management
            System
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
