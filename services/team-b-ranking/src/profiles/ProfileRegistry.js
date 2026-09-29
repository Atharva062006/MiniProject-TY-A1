// Team B — Profile Registry
// In-memory registry for student profiles and drive requirements
// Maintains AdjacencyList and AdjacencyMatrix mapping student skills to drive requirements

const AdjacencyList = require('../graph/AdjacencyList');
const AdjacencyMatrix = require('../graph/AdjacencyMatrix');

class ProfileRegistry {
  constructor() {
    this.students = new Map(); // studentId -> profile
    this.drives = new Map();   // driveId -> requirements
    this.graph_version = 1;

    this.adjacencyList = new AdjacencyList();
    this.adjacencyMatrix = new AdjacencyMatrix();
  }

  /**
   * Helper to ensure vertex exists in both graphs
   */
  _ensureVertex(id, data = {}) {
    if (!this.adjacencyList.vertices.has(id)) {
      this.adjacencyList.addVertex(id, data);
    }
    if (!this.adjacencyMatrix.vertexIndex.has(id)) {
      this.adjacencyMatrix.addVertex(id, data);
    }
  }

  /**
   * Register or update a student profile.
   * @param {string} studentId
   * @param {object} profile - { student_id, skills, cgpa, backlogs, branch, ... }
   */
  registerStudent(studentId, profile = {}) {
    const sId = studentId || profile.student_id;
    const normalizedProfile = {
      student_id: sId,
      skills: Array.isArray(profile.skills) ? profile.skills : [],
      cgpa: profile.cgpa !== undefined ? Number(profile.cgpa) : 0,
      backlogs: profile.backlogs !== undefined ? Number(profile.backlogs) : 0,
      branch: profile.branch || 'GENERAL',
      ...profile,
    };

    this.students.set(sId, normalizedProfile);
    this._ensureVertex(sId, { type: 'student', ...normalizedProfile });

    // Clear previous edges for student in adjacencyList if exists
    if (this.adjacencyList.edges.has(sId)) {
      this.adjacencyList.edges.set(sId, []);
    }

    // Add edges for student skills
    for (const skill of normalizedProfile.skills) {
      const skillName = typeof skill === 'string' ? skill : (skill.name || skill.skill);
      const skillWeight = (typeof skill === 'object' && skill.weight != null) ? Number(skill.weight) : 1;

      if (!skillName) continue;
      this._ensureVertex(skillName, { type: 'skill', name: skillName });
      this.adjacencyList.addEdge(sId, skillName, skillWeight);
      this.adjacencyMatrix.addEdge(sId, skillName, skillWeight);
    }

    this.graph_version++;
    return normalizedProfile;
  }

  /**
   * Register or update drive requirements.
   * @param {string} driveId
   * @param {object} requirements - { drive_id, required_skills: [{name, weight}], min_cgpa, ... }
   */
  registerDrive(driveId, requirements = {}) {
    const dId = driveId || requirements.drive_id;

    // Normalize required_skills to [{ name, weight }]
    let rawSkills = requirements.required_skills || [];
    if (typeof rawSkills === 'string') {
      try {
        rawSkills = JSON.parse(rawSkills);
      } catch {
        rawSkills = [rawSkills];
      }
    }

    const normalizedSkills = rawSkills.map(s => {
      if (typeof s === 'string') return { name: s, weight: 1 };
      return {
        name: s.name || s.skill || '',
        weight: s.weight != null ? Number(s.weight) : 1,
      };
    }).filter(s => Boolean(s.name));

    const normalizedDrive = {
      drive_id: dId,
      required_skills: normalizedSkills,
      min_cgpa: requirements.min_cgpa !== undefined ? Number(requirements.min_cgpa) : 0,
      max_backlogs: requirements.max_backlogs !== undefined ? Number(requirements.max_backlogs) : 0,
      ...requirements,
      required_skills: normalizedSkills,
    };

    this.drives.set(dId, normalizedDrive);
    this._ensureVertex(dId, { type: 'drive', ...normalizedDrive });

    // Ensure all required skills are present in the graph
    for (const req of normalizedSkills) {
      this._ensureVertex(req.name, { type: 'skill', name: req.name });
    }

    this.graph_version++;
    return normalizedDrive;
  }

  /**
   * Retrieve student profile by ID.
   */
  getStudent(studentId) {
    return this.students.get(studentId) || null;
  }

  /**
   * Retrieve drive requirements by ID.
   */
  getDrive(driveId) {
    return this.drives.get(driveId) || null;
  }

  /**
   * Return all stored profiles and graph version.
   */
  getAllProfiles() {
    return {
      students: Array.from(this.students.values()),
      drives: Array.from(this.drives.values()),
      graph_version: this.graph_version,
      stats: {
        total_students: this.students.size,
        total_drives: this.drives.size,
        adjacency_list_vertices: this.adjacencyList.vertices.size,
        adjacency_matrix_vertices: this.adjacencyMatrix.vertices.length,
      },
    };
  }

  /**
   * Get current graph version.
   */
  getGraphVersion() {
    return this.graph_version;
  }

  /**
   * Expose underlying graphs.
   */
  getAdjacencyList() {
    return this.adjacencyList;
  }

  getAdjacencyMatrix() {
    return this.adjacencyMatrix;
  }
}

module.exports = ProfileRegistry;
