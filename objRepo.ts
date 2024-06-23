type class_t = { new(...args: any[]): Object };

export class ObjRepo<loadClasses extends string> {
  private readonly objects = new Map<loadClasses, Map<string, { classname: class_t, params: any }>>();

  addObject(name: `${loadClasses}::${string}`, object: class_t, params: any): void;
  addObject(name: loadClasses, object: class_t, params?: any): void;
  addObject(category: loadClasses, name: string, object: class_t, params?: any): void;
  addObject(param1: loadClasses | `${loadClasses}::${string}`, param2: string | class_t | Record<string, class_t>, param3: class_t | any = null, param4: any = null) {
    let category: loadClasses;
    let name: string;
    let object: class_t;
    let params: any;
    if (typeof param2 == "string") { // single class
      category = param1 as loadClasses;
      name = param2;
      object = param3;
      params = param4 ?? null;

    }
    else if (param1.includes("::")) { // explicit class name
      [category, name] = param1.split("::") as [loadClasses, string];
      object = param2 as class_t;
      params = param3;
    }
    else { // implicit class name
      category = param1 as loadClasses;
      name = param2.name as string;
      object = param2 as class_t;
      params = param3;
    }

    if (!this.objects.has(category)) this.objects.set(category, new Map());
    this.objects.get(category).set(name, { classname: object, params });
  }

  removeObject(category: loadClasses, name: string) {
    return this.objects.get(category)?.delete(name);
  }

  getObject(category: loadClasses, name: string, fallback?: class_t): { classname: class_t, params: any }
  getObject(name: `${loadClasses}::${string}`, fallback?: class_t): { classname: class_t, params: any }
  getObject(param1: loadClasses | `${loadClasses}::${string}`, param2: string | class_t = null, param3: class_t = null) {
    let category: loadClasses;
    let name: string;
    let fallback: class_t;
    if (param2 == null) {
      [category, name] = param1.split("::") as [loadClasses, string];
      fallback = param2 as class_t;
    }
    else [category,name,fallback] = [param1, param2,param3] as [loadClasses, string,class_t];

    const data = this.objects.get(category)?.get(name);
    return {
      classname: data?.classname ?? fallback,
      params: data?.params ?? null
    };
  }
}
