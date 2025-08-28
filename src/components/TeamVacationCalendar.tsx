import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import { fr } from "date-fns/locale";
import { formatDateToLocalString } from "@/utils/dateUtils";

interface TeamVacationCalendarProps {
  vacations: Array<{
    id: string;
    start_date: string;
    end_date: string;
    status: string;
    user_id: string;
    users?: { name: string; email: string; } | null;
    vacation_days?: Array<{ vacation_date: string; is_half_day?: boolean; }>;
  }>;
}

const TEAM_MEMBERS = [
  { name: "Sybille", email: "sybille@example.com", color: "bg-blue-500", textColor: "text-blue-500" },
  { name: "Émilie", email: "emilie@example.com", color: "bg-pink-500", textColor: "text-pink-500" },
  { name: "Leïla", email: "leila@example.com", color: "bg-green-500", textColor: "text-green-500" }
];

export function TeamVacationCalendar({ vacations }: TeamVacationCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  // Filtrer les vacances des membres de l'équipe spécifiés
  const teamVacations = vacations.filter(vacation => {
    const userEmail = vacation.users?.email?.toLowerCase();
    return TEAM_MEMBERS.some(member => 
      userEmail && (
        userEmail.includes(member.name.toLowerCase()) ||
        userEmail === member.email.toLowerCase()
      )
    );
  });

  // Créer une carte des dates de vacances par utilisateur
  const vacationDatesByUser: Record<string, { dates: Date[], color: string, textColor: string }> = {};
  
  teamVacations.forEach(vacation => {
    const userEmail = vacation.users?.email?.toLowerCase() || '';
    const member = TEAM_MEMBERS.find(m => 
      userEmail.includes(m.name.toLowerCase()) || userEmail === m.email.toLowerCase()
    );
    
    if (member && vacation.status === 'approved') {
      if (!vacationDatesByUser[member.name]) {
        vacationDatesByUser[member.name] = { 
          dates: [], 
          color: member.color,
          textColor: member.textColor
        };
      }

      // Utiliser uniquement vacation_days pour les vacances validées
      if (vacation.vacation_days && vacation.vacation_days.length > 0) {
        vacation.vacation_days.forEach(day => {
          try {
            const date = parseISO(day.vacation_date);
            vacationDatesByUser[member.name].dates.push(date);
          } catch (error) {
            console.error('Error parsing vacation date:', error);
          }
        });
      }
      // Ne pas utiliser start_date/end_date comme fallback pour les vacances validées
    }
  });

  // Créer les modifiers pour le calendrier
  const modifiers: Record<string, Date[]> = {};
  const modifiersStyles: Record<string, React.CSSProperties> = {};

  Object.entries(vacationDatesByUser).forEach(([userName, userData]) => {
    const modifierKey = userName.toLowerCase();
    modifiers[modifierKey] = userData.dates;
    
    // Style avec couleur de fond semi-transparente
    if (userName === "Sybille") {
      modifiersStyles[modifierKey] = {
        backgroundColor: 'rgba(59, 130, 246, 0.3)', // blue-500 avec transparence
        borderRadius: '50%',
        border: '2px solid rgb(59, 130, 246)'
      };
    } else if (userName === "Émilie") {
      modifiersStyles[modifierKey] = {
        backgroundColor: 'rgba(236, 72, 153, 0.3)', // pink-500 avec transparence
        borderRadius: '50%',
        border: '2px solid rgb(236, 72, 153)'
      };
    } else if (userName === "Leïla") {
      modifiersStyles[modifierKey] = {
        backgroundColor: 'rgba(34, 197, 94, 0.3)', // green-500 avec transparence
        borderRadius: '50%',
        border: '2px solid rgb(34, 197, 94)'
      };
    }
  });

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Calendrier des congés de l'équipe
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Légende */}
          <div className="flex flex-wrap gap-4 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium text-sm w-full mb-2">Légende :</h4>
            {TEAM_MEMBERS.map((member) => (
              <div key={member.name} className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded-full border-2"
                  style={{
                    backgroundColor: member.name === "Sybille" ? 'rgba(59, 130, 246, 0.3)' :
                                   member.name === "Émilie" ? 'rgba(236, 72, 153, 0.3)' :
                                   'rgba(34, 197, 94, 0.3)',
                    borderColor: member.name === "Sybille" ? 'rgb(59, 130, 246)' :
                               member.name === "Émilie" ? 'rgb(236, 72, 153)' :
                               'rgb(34, 197, 94)'
                  }}
                />
                <span className="text-sm font-medium">{member.name}</span>
              </div>
            ))}
          </div>

          {/* Calendrier */}
          <Calendar
            mode="single"
            selected={undefined}
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            className="w-full rounded-md border p-3 pointer-events-auto"
            classNames={{
              months: "w-full",
              month: "w-full space-y-4",
              caption: "flex justify-center pt-1 relative items-center",
              table: "w-full border-collapse",
              head_row: "flex w-full",
              head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] flex-1 text-center",
              row: "flex w-full mt-2",
              cell: "relative p-0 text-center text-sm flex-1 h-9 w-9",
              day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            }}
            locale={fr}
            modifiers={modifiers}
            modifiersStyles={modifiersStyles}
          />

          {/* Statistiques */}
          <div className="grid grid-cols-3 gap-4">
            {TEAM_MEMBERS.map((member) => {
              const vacationCount = vacationDatesByUser[member.name]?.dates.length || 0;
              return (
                <div key={member.name} className="text-center p-4 bg-muted/30 rounded-lg">
                  <div 
                    className="w-5 h-5 rounded-full border-2 mx-auto mb-2"
                    style={{
                      backgroundColor: member.name === "Sybille" ? 'rgba(59, 130, 246, 0.3)' :
                                     member.name === "Émilie" ? 'rgba(236, 72, 153, 0.3)' :
                                     'rgba(34, 197, 94, 0.3)',
                      borderColor: member.name === "Sybille" ? 'rgb(59, 130, 246)' :
                                 member.name === "Émilie" ? 'rgb(236, 72, 153)' :
                                 'rgb(34, 197, 94)'
                    }}
                  />
                  <div className="font-medium text-sm">{member.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {vacationCount} jour{vacationCount !== 1 ? 's' : ''} de congé
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}