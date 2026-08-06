export class ValidationError extends Error {
  status = 400;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class EntityNotFoundError extends Error {
  status = 404;
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`);
    this.name = "EntityNotFoundError";
  }
}

export class ConflictError extends Error {
  status = 409;
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}
