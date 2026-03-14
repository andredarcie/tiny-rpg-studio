type SkillDefinitionData = {
    id: string;
    nameKey: string;
    descriptionKey: string;
    icon: string;
};
declare class Skill {
    id: string;
    nameKey: string;
    descriptionKey: string;
    icon: string;
    constructor(data: SkillDefinitionData);
}
export type { SkillDefinitionData };
export { Skill };
