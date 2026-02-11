import * as XLSX from 'xlsx';

export const processExcelData = (data) => {
  const workbook = XLSX.read(data, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet);

  const requirementsMap = new Map();

  jsonData.forEach((row, rowIndex) => {
    const Project = row.Project || 'Unknown Project';
    const RequirementID = row.RequirementID;
    const Status = row.Status || 'Unknown Status';
    const StatusDate = row.Date;
    const Comment = row.Comment || '';
    const Sprint = row.Sprint || 'N/A';
    const historyEntryId = `${RequirementID}_hist_${rowIndex}_${new Date().getTime()}`;

    if (!RequirementID) {
      console.warn("Skipping row due to missing RequirementID:", row);
      return;
    }

    let parsedDate;
    if (StatusDate instanceof Date) { // Changed from global.Date
      parsedDate = StatusDate;
    } else if (typeof StatusDate === 'string' || typeof StatusDate === 'number') {
      if (typeof StatusDate === 'number') {
        // Excel stores dates as serial numbers; day 1 is January 1, 1900.
        // JavaScript's Date epoch is January 1, 1970.
        // The offset is 25569 days (for Windows Excel, 24107 for Mac 1904-based).
        // Common practice is to use the 25569 offset.
        parsedDate = new Date((StatusDate - 25569) * 86400 * 1000);
      } else { // String date
        parsedDate = new Date(StatusDate); // Changed from global.Date
      }
    } else {
      console.warn(`Invalid date format for ${RequirementID} (${Status}):`, StatusDate, ". Using current date.");
      parsedDate = new Date(); // Changed from global.Date
    }

    // Check if the date parsing resulted in a valid date
    if (isNaN(parsedDate.getTime())) {
        console.warn(`Could not parse date for ${RequirementID} (${Status}), original value: ${StatusDate}. Using current date as fallback.`);
        parsedDate = new Date(); // Changed from global.Date
    }


    const historyEntry = {
      id: historyEntryId,
      status: Status,
      date: parsedDate,
      comment: Comment,
      sprint: Sprint,
    };

    if (!requirementsMap.has(RequirementID)) {
      requirementsMap.set(RequirementID, {
        id: RequirementID,
        project: Project,
        history: [],
        currentStatusDetails: {},
      });
    }
    requirementsMap.get(RequirementID).history.push(historyEntry);
  });

  const processedRequirements = [];
  requirementsMap.forEach(req => {
    if (req.history.length === 0) {
        console.warn(`Requirement ${req.id} has no history entries.`);
        req.currentStatusDetails = { status: 'N/A', date: new Date(), comment: 'No history', sprint: 'N/A'};
    } else {
        req.history.sort((a, b) => b.date.getTime() - a.date.getTime());
        req.currentStatusDetails = req.history[0];
    }
    processedRequirements.push(req);
  });

  return processedRequirements;
};

export const getUniqueProjects = (requirements) => {
  if (!requirements) return [];
  const projects = new Set();
  requirements.forEach(req => {
    if (req.project) {
        projects.add(req.project);
    }
  });
  return Array.from(projects).sort();
};

export const getSprintsForProject = (requirements, selectedProject) => {
  if (!requirements || !selectedProject) return [];
  const sprints = new Set();
  requirements.forEach(req => {
    if (req.project === selectedProject && req.currentStatusDetails && req.currentStatusDetails.sprint) {
      sprints.add(req.currentStatusDetails.sprint);
    }
  });
  return Array.from(sprints).sort();
};