import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StressBadge from "@/components/StressBadge";
import { Employee } from "@/types/employee";
import { Department, DEPARTMENTS } from "@/types/department";
import Header from "@/components/Header";
import { Building2, Users, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// 🔹 Recharts imports (للرسم البياني)
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const Departments = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);

  useEffect(() => {
    const loadEmployees = async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*");

      if (error) {
        console.error("Error fetching employees:", error);
        return;
      }

      // نطابق شكل الـ Employee type عندك
      if (data) {
        setEmployees(
          data.map((e: any) => ({
            id: e.id,
            name: e.name,
            age: e.age,
            gender: e.gender,
            department: e.department,
            photo: e.photo,
            stressLevel: e.stress_level || "Not Measured Yet",
          }))
        );
      }
    };

    loadEmployees();
  }, []);


  const getDepartmentCount = (department: Department) => {
    return employees.filter((emp) => emp.department === department).length;
  };

  const filteredEmployees = selectedDepartment
    ? employees.filter((emp) => emp.department === selectedDepartment)
    : [];

  // 🔹 بيانات الرسم البياني: عدد الموظفين اللي عندهم Stress في كل قسم
  const departmentStressData = DEPARTMENTS.map((department) => {
    const stressCount = employees.filter(
      (emp) => emp.department === department && emp.stressLevel === "Stress"
    ).length;

    return {
      department,
      stressCount,
    };
  });

  if (selectedDepartment) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />

        <main className="flex-grow container mx-auto py-8 px-4">
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => setSelectedDepartment(null)}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Departments
            </Button>
            <h1 className="text-3xl font-bold mb-2">{selectedDepartment} Department</h1>
            <p className="text-muted-foreground">
              {filteredEmployees.length} employee
              {filteredEmployees.length !== 1 ? "s" : ""}
            </p>
          </div>

          {filteredEmployees.length === 0 ? (
            <Card className="bg-muted/50">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No employees in this department</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredEmployees.map((employee) => (
                <Card
                  key={employee.id}
                  className="overflow-hidden animate-fade-in hover:shadow-lg transition-shadow"
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
                        <h3 className="font-semibold text-lg hover:text-primary transition-colors">
                          {employee.name}
                        </h3>
                      </Link>
                      <StressBadge level={employee.stressLevel} />
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      {employee.department}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Age: {employee.age}
                    </p>
                    <Link to={`/employee/${employee.id}`}>
                      <Button variant="outline" size="sm" className="mt-4 w-full">
                        View Details
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
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
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-grow container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Departments</h1>
          <p className="text-muted-foreground">View employees by department</p>
        </div>

        {/* 🔹 كرت الرسم البياني لعرض عدد الـ Stress في كل قسم */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Departments Stress Overview</CardTitle>
            <p className="text-sm text-muted-foreground">
              Number of stressed employees per department
            </p>
          </CardHeader>
          <CardContent style={{ height: "300px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentStressData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="department" />
                <YAxis allowDecimals={false} domain={[0, 6]} tickCount={7} />
                <Tooltip />
                <Bar
                  dataKey="stressCount"
                  radius={[6, 6, 0, 0]}
                  fill="hsl(var(--primary))"     // 🔥 هذا يغير اللون
                />
              </BarChart>
            </ResponsiveContainer>

          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {DEPARTMENTS.map((department) => {
            const count = getDepartmentCount(department);
            return (
              <Card
                key={department}
                className="cursor-pointer hover:shadow-lg transition-shadow animate-fade-in"
                onClick={() => setSelectedDepartment(department)}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{department}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span className="text-sm">
                      {count} employee{count !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <Button variant="outline" className="w-full mt-4">
                    View Employees
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
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

export default Departments;
