
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PatientInfoCardProps {
  patientName: string;
  setPatientName: (name: string) => void;
}

export const PatientInfoCard = ({ patientName, setPatientName }: PatientInfoCardProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Informations du Patient</CardTitle>
      </CardHeader>
      <CardContent>
        <div>
          <Label htmlFor="patient-name">Nom du Patient</Label>
          <Input
            id="patient-name"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            placeholder="Nom et prénom du patient"
            className="mt-1"
          />
        </div>
      </CardContent>
    </Card>
  );
};
