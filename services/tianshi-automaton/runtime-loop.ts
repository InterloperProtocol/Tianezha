import { startAutonomousRuntimeLoop } from "@/lib/server/autonomous-runtime";
import { startSimulationHeartbeatLoop } from "@/lib/server/tianezha-simulation";

startAutonomousRuntimeLoop();
startSimulationHeartbeatLoop();
