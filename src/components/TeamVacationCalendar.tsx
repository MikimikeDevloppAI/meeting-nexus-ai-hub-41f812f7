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
  { displayName: "Sybille", email: "contacto@eyung.ch", color: "rgb(59, 130, 246)", dotSize: "6px" },
  { displayName: "Emilie",  email: "emilie.eyung@gmail.com", color: "rgb(236, 72, 153)", dotSize: "6px" },
  { displayName: "Leila",   email: "leila.eyung@gmail.com",  color: "rgb(34, 197, 94)", dotSize: "6px" }
];

export function TeamVacationCalendar({ vacations }: TeamVacationCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  // Filtrer les vacances des membres de l'équipe spécifiés
  const teamVacations = vacations.filter(vacation => {
    const userEmail = vacation.users?.email?.toLowerCase();
    return !!userEmail && TEAM_MEMBERS.some(member => userEmail === member.email.toLowerCase());
  });

  // Créer une carte des dates de vacances par utilisateur
  const vacationDatesByUser: Record<string, Date[]> = {};
  
  teamVacations.forEach(vacation => {
    const userEmail = vacation.users?.email?.toLowerCase() || '';
    const member = TEAM_MEMBERS.find(m => userEmail === m.email.toLowerCase());
    
    if (member && vacation.status === 'approved') {
      if (!vacationDatesByUser[member.displayName]) {
        vacationDatesByUser[member.displayName] = [];
      }

      // Utiliser uniquement vacation_days pour les vacances validées
      if (vacation.vacation_days && vacation.vacation_days.length > 0) {
        vacation.vacation_days.forEach(day => {
          try {
            const date = parseISO(day.vacation_date);
            vacationDatesByUser[member.displayName].push(date);
          } catch (error) {
            console.error('Error parsing vacation date:', error);
          }
        });
      }
      // Ne pas utiliser start_date/end_date comme fallback pour les vacances validées
    }
  });

  // Fonction pour obtenir les personnes en congé pour une date donnée
  const getPeopleOnVacation = (date: Date) => {
    return TEAM_MEMBERS.filter(member => {
      const dates = vacationDatesByUser[member.displayName] || [];
      return dates.some(vacDate => 
        vacDate.toDateString() === date.toDateString()
      );
    });
  };

  // Créer un modifier pour les jours avec congés
  const datesWithVacations: Date[] = [];
  Object.values(vacationDatesByUser).forEach(dates => {
    dates.forEach(date => {
      if (!datesWithVacations.some(d => d.toDateString() === date.toDateString())) {
        datesWithVacations.push(date);
      }
    });
  });

  const modifiers = {
    vacation: datesWithVacations
  };

  const modifiersStyles = {
    vacation: {
      position: 'relative' as const
    }
  };

  // Custom day renderer avec les petits ronds
  const DayContentRenderer = ({ date }: { date: Date }) => {
    const peopleOnVacation = getPeopleOnVacation(date);
    const dayNumber = date.getDate();

    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center">
        <span className="text-sm">{dayNumber}</span>
        {peopleOnVacation.length > 0 && (
          <div className="absolute bottom-0 flex gap-0.5 justify-center">
            {peopleOnVacation.map((person, index) => (
              <div
                key={person.displayName}
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor: person.color
                }}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="w-full shadow-md hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Calendrier des congés de l'équipe
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">

          {/* Calendrier avec rendu personnalisé */}
          <div className="w-full rounded-md border p-3">
            <Calendar
              mode="single"
              selected={undefined}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              className="w-full pointer-events-auto"
              classNames={{
                months: "w-full",
                month: "w-full space-y-4",
                caption: "flex justify-center pt-1 relative items-center",
                table: "w-full border-collapse",
                head_row: "flex w-full",
                head_cell: "text-muted-foreground rounded-md w-10 font-normal text-[0.8rem] flex-1 text-center",
                row: "flex w-full mt-2",
                cell: "relative p-0 text-center text-sm flex-1 h-10 w-10",
                day: "h-10 w-10 p-0 font-normal relative inline-flex items-center justify-center rounded-md text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              }}
              locale={fr}
              modifiers={modifiers}
              modifiersStyles={modifiersStyles}
              components={{
                DayContent: DayContentRenderer
              }}
            />
          </div>

          {/* Statistiques */}
          <div className="grid grid-cols-3 gap-4">
            {TEAM_MEMBERS.map((member) => {
              const vacationCount = (vacationDatesByUser[member.displayName]?.length) || 0;
              return (
                <div key={member.email} className="text-center p-4 bg-muted/30 rounded-lg">
                  <div 
                    className="w-4 h-4 rounded-full mx-auto mb-2"
                    style={{
                      backgroundColor: member.color
                    }}
                  />
                  <div className="font-medium text-sm">{member.displayName}</div>
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