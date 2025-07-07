
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface PatientInfoCardProps {
  patientName: string;
  setPatientName: (name: string) => void;
}

export const PatientInfoCard = ({ patientName, setPatientName }: PatientInfoCardProps) => {
  const [patientAddress, setPatientAddress] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informations du Patient</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
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
          
          <div>
            <Label htmlFor="patient-address">Adresse du Patient (optionnel)</Label>
            <Textarea
              id="patient-address"
              value={patientAddress}
              onChange={(e) => setPatientAddress(e.target.value)}
              placeholder="Adresse complète du patient"
              className="mt-1"
              rows={3}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
