"use client";

import { Calendar } from "./calendar";
import { useState } from "react";

const meta = {
  title: "ui/calendar",
  component: Calendar,
  tags: ["autodocs"],
};

export default meta;

export const Cxd = {
  render: () => {
    const today = new Date();
    const [month, setMonth] = useState(new Date(2026, 0, 1));

    return (
      <div className="flex items-center justify-center p-8 bg-slate-950 w-fit h-fit">
        <Calendar
          month={month}
          onMonthChange={setMonth}
          disabled={[{ after: today }]}
          className=" w-fit h-fit"
          fixedWeeks={true}
          mode={"range"}
          navLayout={"after"}
          pagedNavigation={true}
          role={"application"}
          weekStartsOn={1}
          initialFocus={true}
        />
      </div>
    );
  },
};
