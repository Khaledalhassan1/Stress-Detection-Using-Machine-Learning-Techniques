import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import StressBadge from "@/components/StressBadge";
import { Employee, StressLevelType } from "@/types/employee";
import { DetectionData } from "@/types/detection";
import Header from "@/components/Header";
import { supabase } from "@/lib/supabaseClient";

// NEW: Tabs + Recharts imports
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";


// نفس الدالة (نقدر ننقلها لملف utils لاحقاً)
const mapResultToStressLevel = (raw: string): StressLevelType => {
  const value = raw.toLowerCase().trim();

  if (value.includes("not stress") || value.includes("no stress")) {
    return "Not Stress";
  }

  if (value.includes("stress")) {
    return "Stress";
  }

  return "Stress";
};
// Format timestamp correctly (fixed date issue)
const formatTimestamp = (isoString: string) => {
  const date = new Date(isoString);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const time = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return {
    date: `${day}/${month}/${year}`,
    time,
  };
};


const EmployeeDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [detectionHistory, setDetectionHistory] = useState<DetectionData[]>([]);

  useEffect(() => {
    if (!id) return;

    const loadData = async () => {
      setIsLoading(true);

      try {
        // 1) نحمل الموظف
        const { data: empData, error: empError } = await supabase
          .from("employees")
          .select("*")
          .eq("id", id)
          .single();

        if (empError || !empData) {
          console.error("Error loading employee:", empError);
          toast.error("Employee not found");
          navigate("/", { replace: true });
          return;
        }

        let currentEmployee: Employee = {
          id: empData.id,
          name: empData.name,
          age: empData.age,
          gender: empData.gender,
          department: empData.department,
          photo: empData.photo,
          stressLevel: empData.stress_level || "Not Measured Yet",
        };

        // 2) نحمل تاريخ الـ detections لهذا الموظف
        const { data: detData, error: detError } = await supabase
          .from("detections")
          .select("*")
          .eq("employee_id", id)
          .order("timestamp", { ascending: false });

        if (detError) {
          console.error("Error loading detection history:", detError);
        }

        if (detData && detData.length > 0) {
          const mappedDetections: DetectionData[] = detData.map((d: any) => ({
            id: d.id,
            employeeId: d.employee_id,
            bloodVolumePulse: d.blood_volume_pulse,
            electrodermalActivity: d.electrodermal_activity,
            bodyTemperature: d.body_temperature,
            movementActivity: d.movement_activity,
            result: d.result,
            advice: d.advice ?? undefined,
            timestamp:
              typeof d.timestamp === "string"
                ? d.timestamp
                : new Date(d.timestamp).toISOString(),
          }));

          setDetectionHistory(mappedDetections);

          const latest = mappedDetections[0];
          const level = mapResultToStressLevel(latest.result);
          currentEmployee = {
            ...currentEmployee,
            stressLevel: level,
          };
        } else {
          // لا يوجد أي كشف في Supabase
          if (!currentEmployee.stressLevel) {
            currentEmployee = {
              ...currentEmployee,
              stressLevel: "Not Measured Yet",
            };
          }
          setDetectionHistory([]); // مهم عشان التابات تفهم أنه فاضي
        }

        setEmployee(currentEmployee);
      } catch (error) {
        console.error("Error loading employee or detections:", error);
        toast.error("Failed to load employee data");
        navigate("/", { replace: true });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [id, navigate]);

  // NEW: تجهيز بيانات الرسم البياني (أيام الـ Stress فقط)
  // خط الاتجاه: Stress يرفع، Not Stress ينزل
  const stressChartData = (() => {
    if (!detectionHistory.length) return [];

    // نرتّب القراءات من الأقدم إلى الأحدث
    const sorted = [...detectionHistory].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return sorted.map((detection, index) => {
      const level = mapResultToStressLevel(detection.result); // "Stress" أو "Not Stress"

      return {
        step: index + 1,
        label: new Date(detection.timestamp).toLocaleDateString(),
        value: level === "Stress" ? 1 : 0, // 👈 أهم شيء هنا — بدون -1 نهائياً
        level,
      };
    });
  })();




  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this employee?")) {
      try {
        const savedEmployees = localStorage.getItem("employees");
        if (savedEmployees) {
          const parsedEmployees: Employee[] = JSON.parse(savedEmployees);
          const updatedEmployees = parsedEmployees.filter(
            (emp) => emp.id !== id
          );

          localStorage.setItem("employees", JSON.stringify(updatedEmployees));
          toast.success("Employee deleted successfully");
          navigate("/", { replace: true });
        }
      } catch (error) {
        console.error("Error deleting employee:", error);
        toast.error("Failed to delete employee");
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-grow container mx-auto py-8 px-4 flex items-center justify-center">
          <p>Loading employee information...</p>
        </main>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-grow container mx-auto py-8 px-4 flex items-center justify-center">
          <p>Employee not found</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-grow container mx-auto py-8 px-4">
        <div className="mb-6 flex items-center">
          <Button variant="ghost" size="sm" asChild className="mr-4">
            <Link to="/">&larr; Back to Dashboard</Link>
          </Button>
        </div>

        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader className="pb-0">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-3xl font-bold">
                    {employee.name}
                  </CardTitle>
                  <p className="text-muted-foreground mt-1">
                    {employee.department}
                  </p>
                </div>
                <div className="flex gap-2 items-start">
                  <Button asChild>
                    <Link to={`/employee/${id}/stress-detection`}>
                      Stress Detection
                    </Link>
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="aspect-square w-full overflow-hidden rounded-lg bg-muted">
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

                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Employee Information
                    </h3>

                    <dl className="mt-2 divide-y divide-border">
                      <div className="flex justify-between py-3">
                        <dt className="text-sm font-medium">Full Name</dt>
                        <dd className="text-sm">{employee.name}</dd>
                      </div>

                      <div className="flex justify-between py-3">
                        <dt className="text-sm font-medium">Age</dt>
                        <dd className="text-sm">{employee.age}</dd>
                      </div>

                      <div className="flex justify-between py-3">
                        <dt className="text-sm font-medium">Gender</dt>
                        <dd className="text-sm">{employee.gender}</dd>
                      </div>

                      <div className="flex justify-between py-3">
                        <dt className="text-sm font-medium">Department</dt>
                        <dd className="text-sm">{employee.department}</dd>
                      </div>

                      <div className="flex justify-between py-3">
                        <dt className="text-sm font-medium">Stress Level</dt>
                        <dd className="text-sm">
                          <StressBadge level={employee.stressLevel} />
                        </dd>
                      </div>

                      <div className="flex justify-between py-3">
                        <dt className="text-sm font-medium">Employee ID</dt>
                        <dd className="text-sm font-mono">
                          {employee.id.slice(0, 8)}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="pt-4">
                    <Button variant="destructive" onClick={handleDelete}>
                      Delete Employee
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detection History Section with Tabs */}
          {detectionHistory.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Detection History</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Previous stress detection results for this employee
                </p>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="list" className="w-full">
                  <TabsList className="mb-4">
                    <TabsTrigger value="list">List</TabsTrigger>
                    <TabsTrigger value="chart">Chart</TabsTrigger>
                  </TabsList>

                  {/* Tab 1: List View (الكود القديم تقريبًا كما هو) */}
                  <TabsContent value="list">
                    <ScrollArea className="h-80 w-full">
                      <div className="space-y-4">
                        {detectionHistory.map((detection) => {
                          const { date, time } = formatTimestamp(detection.timestamp);

                          return (
                            <div
                              key={detection.id}
                              className="border rounded-lg p-4 space-y-2"
                            >
                              <div className="flex justify-between items-start">
                                <div className="text-sm font-medium">
                                  {date} at {time}
                                </div>
                                <div className="text-sm font-semibold text-primary">
                                  {detection.result}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">
                                    Blood Volume Pulse:
                                  </span>
                                  <div className="font-medium">
                                    {detection.bloodVolumePulse} V
                                  </div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    Electrodermal Activity:
                                  </span>
                                  <div className="font-medium">
                                    {detection.electrodermalActivity}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    Body Temperature:
                                  </span>
                                  <div className="font-medium">
                                    {detection.bodyTemperature}°
                                  </div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    Movement Activity:
                                  </span>
                                  <div className="font-medium capitalize">
                                    {detection.movementActivity}
                                  </div>
                                </div>
                              </div>

                              <div className="text-sm">
                                <span className="text-muted-foreground">Result:</span>
                                <span className="ml-2 font-medium">
                                  {detection.result}
                                </span>
                              </div>

                              {detection.advice && (
                                <div className="text-sm mt-1">
                                  <span className="text-muted-foreground">
                                    Advice:
                                  </span>
                                  <span className="ml-2 font-medium">
                                    {detection.advice}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </TabsContent>



                  <TabsContent value="chart">
                    {stressChartData.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No detection records for this employee yet.
                      </p>
                    ) : (
                      <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={stressChartData}>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              vertical={false}
                              stroke="hsl(var(--border))"
                            />
                            {/* نعرض الرقم التسلسلي أو تقدر تغيّرها إلى label لو تبي التاريخ */}
                            <XAxis
                              dataKey="step"
                              stroke="hsl(var(--muted-foreground))"
                              tick={{ fill: "hsl(var(--foreground))" }}
                            />
                            <YAxis
                              domain={[0, 1]}
                              allowDecimals={false}
                              tickCount={2}
                              stroke="hsl(var(--muted-foreground))"
                              tick={{ fill: "hsl(var(--foreground))" }}
                            />


                            <Tooltip
                              labelFormatter={(step) => {
                                const item = stressChartData.find((d) => d.step === step);
                                return item ? `${item.label} (Reading #${step})` : `Reading #${step}`;
                              }}
                              formatter={(value, _name, props: any) => {
                                const lvl = props.payload.level;
                                return [
                                  value,
                                  lvl === "Stress" ? "Score (Stress ↑)" : "Score (Not Stress ↓)",
                                ];
                              }}
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                                color: "hsl(var(--card-foreground))",
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="value"
                              stroke="hsl(var(--primary))"
                              strokeWidth={3}
                              // نلون النقطة حسب النتيجة: Stress أحمر، Not Stress أخضر مثلاً
                              dot={(props) => {
                                const { cx, cy, payload } = props as any;
                                const isStress = payload.level === "Stress";
                                return (
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={5}
                                    fill={
                                      isStress
                                        ? "hsl(var(--destructive))"
                                        : "hsl(var(--primary))"
                                    }
                                  />
                                );
                              }}
                              activeDot={{ r: 7 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </TabsContent>


                </Tabs>
              </CardContent>
            </Card>
          )}
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

export default EmployeeDetail;
