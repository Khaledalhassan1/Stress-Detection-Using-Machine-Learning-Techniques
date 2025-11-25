import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Employee, GenderType, StressLevelType } from "@/types/employee";
import { Department, DEPARTMENTS } from "@/types/department";
import Header from "@/components/Header";
import { supabase } from "@/lib/supabaseClient";

const AddEmployee = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    age: "",
    department: "" as Department | "",
    gender: "" as GenderType | "",
    photo: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, photo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // نستخدم قيمة ثابتة كبداية
  const initialStressLevel: StressLevelType = "Not Measured Yet";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // ✅ Validate form data
      if (!formData.name.trim()) {
        toast.error("Please enter employee name");
        setIsSubmitting(false);
        return;
      }

      if (
        !formData.age ||
        isNaN(Number(formData.age)) ||
        Number(formData.age) <= 0
      ) {
        toast.error("Please enter a valid age");
        setIsSubmitting(false);
        return;
      }

      if (!formData.department) {
        toast.error("Please select a department");
        setIsSubmitting(false);
        return;
      }

      if (!formData.gender) {
        toast.error("Please select gender");
        setIsSubmitting(false);
        return;
      }

      const newEmployee: Employee = {
        id: uuidv4(),
        name: formData.name.trim(),
        age: Number(formData.age),
        department: formData.department as Department,
        gender: formData.gender as GenderType,
        stressLevel: initialStressLevel,
        ...(formData.photo && { photo: formData.photo }),
      };

      // ✅ Insert into Supabase instead of localStorage
      const { error } = await supabase.from("employees").insert({
        id: newEmployee.id,
        name: newEmployee.name,
        age: newEmployee.age,
        department: newEmployee.department,
        gender: newEmployee.gender,
        stress_level: newEmployee.stressLevel,
        photo: newEmployee.photo ?? null,
      });

      if (error) {
        console.error("Error inserting employee:", error);
        toast.error(error.message || "Failed to add employee");
        setIsSubmitting(false);
        return;
      }


      toast.success("Employee added successfully");
      navigate("/");
    } catch (error) {
      console.error("Error adding employee:", error);
      toast.error("Failed to add employee");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-grow container mx-auto py-8 px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Add New Employee</h1>
          <p className="text-muted-foreground">
            Enter the employee details below
          </p>
        </div>

        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Employee Information</CardTitle>
            <CardDescription>
              Please fill in all required fields to add a new employee.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name Field */}
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Enter employee full name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* Age Field */}
              <div className="space-y-2">
                <Label htmlFor="age">Age *</Label>
                <Input
                  id="age"
                  name="age"
                  type="number"
                  placeholder="Enter employee age"
                  value={formData.age}
                  onChange={handleChange}
                  min="18"
                  max="100"
                  required
                />
              </div>

              {/* Department Field */}
              <div className="space-y-2">
                <Label htmlFor="department">Department *</Label>
                <Select
                  value={formData.department}
                  onValueChange={(value) =>
                    handleSelectChange("department", value)
                  }
                >
                  <SelectTrigger id="department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Gender Field */}
              <div className="space-y-2">
                <Label>Gender *</Label>
                <RadioGroup
                  value={formData.gender}
                  onValueChange={(value) =>
                    handleSelectChange("gender", value as GenderType)
                  }
                  className="flex flex-col space-y-1"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Male" id="gender-male" />
                    <Label htmlFor="gender-male" className="cursor-pointer">
                      Male
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Female" id="gender-female" />
                    <Label htmlFor="gender-female" className="cursor-pointer">
                      Female
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Photo Upload Field - optional */}
              <div className="space-y-2">
                <Label htmlFor="photo">Personal Photo (Optional)</Label>
                <div className="grid gap-4">
                  <Input
                    id="photo"
                    name="photo"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                  />

                  {formData.photo && (
                    <div className="relative aspect-square w-32 overflow-hidden rounded-md border">
                      <img
                        src={formData.photo}
                        alt="Employee preview"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Adding..." : "Add Employee"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>

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

export default AddEmployee;
