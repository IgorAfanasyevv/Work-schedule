import React from 'react';
import { useScheduler } from '../SchedulerContext';
import ShiftDetailModal from './modals/ShiftDetailModal';
import ReplacementsModal from './modals/ReplacementsModal';
import MarkUnavailableModal from './modals/MarkUnavailableModal';
import EmployeeModal from './modals/EmployeeModal';
import BlockModal from './modals/BlockModal';
import ShiftTypeModal from './modals/ShiftTypeModal';
import AdhocShiftModal from './modals/AdhocShiftModal';
import DayConstraintsModal from './modals/DayConstraintsModal';

export default function ModalHost() {
  const { modal } = useScheduler();
  if (!modal) return null;

  switch (modal.type) {
    case 'shiftDetail':
      return <ShiftDetailModal instanceId={modal.instanceId} />;
    case 'replacements':
      return <ReplacementsModal instanceId={modal.instanceId} />;
    case 'markUnavailable':
      return <MarkUnavailableModal instanceId={modal.instanceId} />;
    case 'addEditEmployee':
      return <EmployeeModal employeeId={modal.employeeId} />;
    case 'addBlock':
      return <BlockModal employeeId={modal.employeeId} />;
    case 'shiftType':
      return <ShiftTypeModal shiftTypeId={modal.shiftTypeId} />;
    case 'adhocShift':
      return <AdhocShiftModal />;
    case 'dayConstraints':
      return <DayConstraintsModal employeeId={modal.employeeId} day={modal.day} />;
    default:
      return null;
  }
}
