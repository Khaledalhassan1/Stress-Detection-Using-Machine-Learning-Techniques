import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Employee, StressLevelType } from "@/types/employee";
import { DetectionData, DetectionInput } from "@/types/detection";
import Header from "@/components/Header";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/supabaseClient";

// URL الباك اند للتنبؤ
const PREDICT_URL = "https://nonpestilent-mercedez-mousey.ngrok-free.dev/predict";

// نفس خريطة الحركة
const ACC_MAP: Record<string, [number, number, number]> = {
  "no activity": [-42, -25, -4],
  "low activity": [-11, 0, 12],
  "medium activity": [40, 22, 26],
  "high activity": [57, 57, 45],
};
const mapResultToStressLevel = (raw: string): StressLevelType => {
  const value = raw.toLowerCase().trim();

  // نغطي كل الصيغ المحتملة من الباك إند
  if (
    value.includes("not stress") ||
    value.includes("no stress") ||
    value.includes("not stressed") ||
    value.includes("no-stress") ||
    value === "normal"
  ) {
    return "Not Stress";
  }

  if (value.includes("stress")) {
    return "Stress";
  }

  // لو النص غريب نخليها Stress كـ default
  return "Stress";
};


const StressDetection = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [detectionData, setDetectionData] = useState<DetectionInput>({
    bloodVolumePulse: "",
    electrodermalActivity: "",
    bodyTemperature: "",
    movementActivity: "",
  });
  const [isDetecting, setIsDetecting] = useState(false);

  // 🚀 1) تحميل بيانات الموظف من Supabase
  useEffect(() => {
    const loadEmployee = async () => {
      if (!id) return;

      try {
        const { data, error } = await supabase
          .from("employees")
          .select("*")
          .eq("id", id)
          .single();

        if (error || !data) {
          console.error("Error loading employee:", error);
          toast.error("Employee not found");
          navigate("/", { replace: true });
          return;
        }

        const emp: Employee = {
          id: data.id,
          name: data.name,
          age: data.age,
          gender: data.gender,
          department: data.department,
          photo: data.photo,
          stressLevel: data.stress_level || "Not Measured Yet",
        };

        setEmployee(emp);
      } catch (err) {
        console.error("Error loading employee:", err);
        toast.error("Failed to load employee data");
        navigate("/", { replace: true });
      } finally {
        setIsLoading(false);
      }
    };

    loadEmployee();
  }, [id, navigate]);

  const handleInputChange = (field: keyof DetectionInput, value: string) => {
    setDetectionData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleStartDetection = async () => {
    if (!employee || !id) return;

    // ✅ 2) التحقق من المدخلات
    const BVP = parseFloat(detectionData.bloodVolumePulse);
    const EDA = parseFloat(detectionData.electrodermalActivity);
    const TEMP = parseFloat(detectionData.bodyTemperature);

    if (Number.isNaN(BVP) || Number.isNaN(EDA) || Number.isNaN(TEMP)) {
      toast.error("Please enter valid numeric values for all fields");
      return;
    }

    if (BVP < -500 || BVP > 1500) {
      toast.error("BVP value is out of realistic range (-500–1500 V).");
      return;
    }
    if (EDA < 0 || EDA > 100) {
      toast.error("EDA value is out of realistic range (0–100 µS).");
      return;
    }
    if (TEMP < 25 || TEMP > 43) {
      toast.error("Body Temperature value is out of realistic range (25–43°C).");
      return;
    }

    if (!detectionData.movementActivity) {
      toast.error("Please select a movement activity level");
      return;
    }

    const acc = ACC_MAP[detectionData.movementActivity];
    if (!acc) {
      toast.error("Unknown movement activity value. Please select from the list.");
      return;
    }

    setIsDetecting(true);

    try {
      // ✅ 3) إرسال الطلب إلى /predict
      const payloadForPredict = {
        BVP,
        EDA,
        TEMP,
        ACC_x: acc[0],
        ACC_y: acc[1],
        ACC_z: acc[2],
      };

      const res = await fetch(PREDICT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadForPredict),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Predict request failed: ${res.status}${text ? ` - ${text}` : ""}`);
      }

      const data = await res.json().catch(() => ({} as any));
      const resultText =
        data.result || data.prediction || data.stress || data.label || "Result received";

      // ممكن الباك اند يرجّع نص نصيحة
      const adviceText = data.advice ?? null;

      const newDetection: DetectionData = {
        id: uuidv4(),
        employeeId: employee.id,
        bloodVolumePulse: BVP,
        electrodermalActivity: EDA,
        bodyTemperature: TEMP,
        movementActivity: detectionData.movementActivity,
        result: String(resultText),
        advice: adviceText || undefined,
        timestamp: new Date().toISOString(),
      };

      // ✅ 4) حفظ النتيجة في جدول detections في Supabase
      const { error: insertError } = await supabase.from("detections").insert({
        id: newDetection.id,
        employee_id: newDetection.employeeId,
        blood_volume_pulse: newDetection.bloodVolumePulse,
        electrodermal_activity: newDetection.electrodermalActivity,
        body_temperature: newDetection.bodyTemperature,
        movement_activity: newDetection.movementActivity,
        result: newDetection.result,
        advice: newDetection.advice ?? null,
        timestamp: newDetection.timestamp,
      });

      if (insertError) {
        console.error("Error inserting detection:", insertError);
        toast.error("Failed to save detection result");
        return;
      }

      // ✅ 5) تحديث مستوى الضغط في جدول employees (اختياري لكن مفيد للـ Dashboard)
      // ✅ 5) تحديث مستوى الضغط في جدول employees بناءً على النتيجة
      const newStressLevel = mapResultToStressLevel(newDetection.result);

      const { error: updateError } = await supabase
        .from("employees")
        .update({ stress_level: newStressLevel })
        .eq("id", employee.id);

      if (updateError) {
        console.error("Error updating employee stress level:", updateError);
      }


      if (updateError) {
        console.error("Error updating employee stress level:", updateError);
      }

      toast.success(`Detection completed! Result: ${newDetection.result}`);

      // ✅ 6) رجوع لصفحة تفاصيل الموظف
      navigate(`/employee/${id}`);

    } catch (error: any) {
      console.error("Error during detection:", error);
      toast.error(error?.message || "Failed to complete detection");
    } finally {
      setIsDetecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-grow container mx-auto py-8 px-4 flex items-center justify-center">
          <p>Loading...</p>
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
            <Link to={`/employee/${id}`}>
              &larr; Back to Employee Details
            </Link>
          </Button>
        </div>

        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                Stress Detection – {employee.name}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Enter vital signs to perform stress level detection
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                  <Label htmlFor="bloodVolumePulse">Blood Volume Pulse (V)</Label>
                  <Input
                    id="bloodVolumePulse"
                    type="number"
                    step="0.01"
                    placeholder="Enter blood volume pulse"
                    value={detectionData.bloodVolumePulse}
                    onChange={(e) => handleInputChange("bloodVolumePulse", e.target.value)}
                    disabled={isDetecting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="electrodermalActivity">Electrodermal Activity</Label>
                  <Input
                    id="electrodermalActivity"
                    type="number"
                    step="0.01"
                    placeholder="Enter electrodermal activity"
                    value={detectionData.electrodermalActivity}
                    onChange={(e) => handleInputChange("electrodermalActivity", e.target.value)}
                    disabled={isDetecting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bodyTemperature">Body Temperature</Label>
                  <Input
                    id="bodyTemperature"
                    type="number"
                    step="0.1"
                    placeholder="Enter body temperature"
                    value={detectionData.bodyTemperature}
                    onChange={(e) => handleInputChange("bodyTemperature", e.target.value)}
                    disabled={isDetecting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="movementActivity">Movement Activity</Label>
                  <Select
                    value={detectionData.movementActivity}
                    onValueChange={(value) => handleInputChange("movementActivity", value)}
                    disabled={isDetecting}
                  >
                    <SelectTrigger id="movementActivity">
                      <SelectValue placeholder="Select activity level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high activity">High Activity</SelectItem>
                      <SelectItem value="medium activity">Medium Activity</SelectItem>
                      <SelectItem value="low activity">Low Activity</SelectItem>
                      <SelectItem value="no activity">No Activity</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={handleStartDetection}
                disabled={
                  isDetecting ||
                  !detectionData.bloodVolumePulse ||
                  !detectionData.electrodermalActivity ||
                  !detectionData.bodyTemperature ||
                  !detectionData.movementActivity
                }
                className="w-full"
              >
                {isDetecting ? "Processing..." : "Start Detection"}
              </Button>
            </CardContent>
          </Card>
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

export default StressDetection;
